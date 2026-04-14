import { RoomObjectCategory } from '@nitrots/nitro-renderer';
import { FC, useEffect, useRef, useState } from 'react';
import { GetRoomEngine, WiredFurniType } from '../../../../api';
import { Button, Column, Flex, Text } from '../../../../common';
import { useObjectRollOverEvent, useWired } from '../../../../hooks';
import { WiredActionBaseView } from './WiredActionBaseView';

interface ZoneConfig
{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    invert: boolean;
    filterExisting: boolean;
}

interface TilePos { x: number; y: number; }

export const WiredActionSelectorUsersInZoneView: FC<{}> = props =>
{
    const [ minX, setMinX ] = useState(0);
    const [ maxX, setMaxX ] = useState(0);
    const [ minY, setMinY ] = useState(0);
    const [ maxY, setMaxY ] = useState(0);
    const [ invert, setInvert ] = useState(false);
    const [ selecting, setSelecting ] = useState(false);
    const [ liveZone, setLiveZone ] = useState<ZoneConfig | null>(null);

    const hoverPos = useRef<TilePos | null>(null);
    const cornerA = useRef<TilePos | null>(null);
    const isDragging = useRef(false);

    const { trigger = null, setIntParams = null, setStringParam = null } = useWired();

    const save = () =>
    {
        setIntParams([ minX, maxX, minY, maxY ]);
        setStringParam(JSON.stringify({ minX, maxX, minY, maxY, invert, filterExisting: false }));
    };

    const buildZone = (a: TilePos, b: TilePos): ZoneConfig => ({
        minX: Math.min(a.x, b.x),
        maxX: Math.max(a.x, b.x),
        minY: Math.min(a.y, b.y),
        maxY: Math.max(a.y, b.y),
        invert,
        filterExisting: false,
    });

    // Survol → met à jour hoverPos + preview live si drag en cours
    useObjectRollOverEvent(event =>
    {
        if(!selecting) return;
        if(event.category === RoomObjectCategory.UNIT) return;

        const obj = GetRoomEngine().getRoomObject(event.roomId, event.id, event.category);

        if(!obj) return;

        const pos = obj.getLocation();
        const tile: TilePos = { x: Math.floor(pos.x), y: Math.floor(pos.y) };

        hoverPos.current = tile;

        if(isDragging.current && cornerA.current)
        {
            setLiveZone(buildZone(cornerA.current, tile));
        }
    });

    useEffect(() =>
    {
        if(!selecting) return;

        // Trouver le canvas Pixi (renderer Nitro)
        const canvas = document.querySelector('canvas');

        if(!canvas) return;

        // Bloquer UNIQUEMENT le mousedown → empêche le drag Pixi
        // Le mousemove continue de passer normalement → OBJECT_ROLL_OVER fonctionne
        const onCanvasMouseDown = (e: Event) =>
        {
            e.stopImmediatePropagation();

            if(!hoverPos.current) return;

            cornerA.current = { ...hoverPos.current };
            isDragging.current = true;
            setLiveZone(buildZone(cornerA.current, cornerA.current));
        };

        // Finaliser la sélection au relâchement (n'importe où sur la page)
        const onMouseUp = () =>
        {
            if(!isDragging.current) return;

            isDragging.current = false;

            const a = cornerA.current;
            const b = hoverPos.current ?? cornerA.current;

            if(a && b)
            {
                const zone = buildZone(a, b);

                setMinX(zone.minX);
                setMaxX(zone.maxX);
                setMinY(zone.minY);
                setMaxY(zone.maxY);
            }

            cornerA.current = null;
            setLiveZone(null);
            setSelecting(false);
        };

        const onKeyDown = (e: KeyboardEvent) =>
        {
            if(e.key !== 'Escape') return;

            isDragging.current = false;
            cornerA.current = null;
            hoverPos.current = null;
            setLiveZone(null);
            setSelecting(false);
        };

        // cursor crosshair sur le canvas pendant la sélection
        (canvas as HTMLElement).style.cursor = 'crosshair';

        canvas.addEventListener('mousedown', onCanvasMouseDown, { capture: true });
        document.addEventListener('mouseup', onMouseUp);
        window.addEventListener('keydown', onKeyDown);

        return () =>
        {
            (canvas as HTMLElement).style.cursor = '';
            canvas.removeEventListener('mousedown', onCanvasMouseDown, { capture: true } as any);
            document.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [ selecting ]);

    useEffect(() =>
    {
        if(!trigger) return;

        try
        {
            if(trigger.stringData)
            {
                const config: ZoneConfig = JSON.parse(trigger.stringData);

                setMinX(config.minX ?? 0);
                setMaxX(config.maxX ?? 0);
                setMinY(config.minY ?? 0);
                setMaxY(config.maxY ?? 0);
                setInvert(config.invert ?? false);

                return;
            }
        }
        catch {}

        if(trigger.intData.length >= 4)
        {
            setMinX(trigger.intData[0]);
            setMaxX(trigger.intData[1]);
            setMinY(trigger.intData[2]);
            setMaxY(trigger.intData[3]);
        }
    }, [ trigger ]);

    const display = liveZone ?? { minX, maxX, minY, maxY };
    const hasZone = display.minX !== 0 || display.maxX !== 0 || display.minY !== 0 || display.maxY !== 0;

    return (
        <WiredActionBaseView requiresFurni={ WiredFurniType.STUFF_SELECTION_OPTION_NONE } hasSpecialInput={ true } save={ save }>
            <Column gap={ 2 }>
                <Text bold>Zone de sélection</Text>
                <Button variant={ selecting ? 'primary' : 'secondary' } onClick={ () => setSelecting(v => !v) }>
                    { selecting
                        ? (isDragging.current ? 'Relâche pour valider...' : 'Survole puis clique-glisse...')
                        : 'Sélectionner la zone'
                    }
                </Button>
                { (selecting || hasZone) &&
                    <Column gap={ 1 }>
                        <Text small>X : { display.minX } → { display.maxX }</Text>
                        <Text small>Y : { display.minY } → { display.maxY }</Text>
                        { selecting && !hoverPos.current &&
                            <Text small variant="danger">Survole d'abord un meuble ou une tuile...</Text>
                        }
                    </Column>
                }
                <Flex alignItems="center" gap={ 1 }>
                    <input
                        type="checkbox"
                        className="form-check-input"
                        id="wired-zone-invert"
                        checked={ invert }
                        onChange={ e => setInvert(e.target.checked) } />
                    <Text><label htmlFor="wired-zone-invert">Inverser la zone</label></Text>
                </Flex>
            </Column>
        </WiredActionBaseView>
    );
}
