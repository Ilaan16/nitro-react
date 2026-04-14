import { MouseEventType, RoomObjectCategory } from '@nitrots/nitro-renderer';
import { FC, useEffect, useRef, useState } from 'react';
import { GetRoomEngine, WiredFurniType } from '../../../../api';
import { Button, Column, Flex, Text } from '../../../../common';
import { useObjectRollOverEvent, useRoom, useWired } from '../../../../hooks';
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
    const [ preview, setPreview ] = useState<ZoneConfig | null>(null);

    const hoverPos = useRef<TilePos | null>(null);
    const cornerA = useRef<TilePos | null>(null);

    const { trigger = null, setIntParams = null, setStringParam = null } = useWired();
    const { roomSession = null } = useRoom();

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

    // Survol → met à jour la position courante + preview si drag en cours
    useObjectRollOverEvent(event =>
    {
        if(!selecting) return;
        if(event.category === RoomObjectCategory.UNIT) return;

        const obj = GetRoomEngine().getRoomObject(event.roomId, event.id, event.category);

        if(!obj) return;

        const pos = obj.getLocation();
        const tile: TilePos = { x: Math.floor(pos.x), y: Math.floor(pos.y) };

        hoverPos.current = tile;

        if(cornerA.current) setPreview(buildZone(cornerA.current, tile));
    });

    // Overlay pour bloquer le drag Nitro + gérer mousedown/mouseup
    useEffect(() =>
    {
        if(!selecting || !roomSession) return;

        const overlay = document.createElement('div');

        overlay.style.cssText = 'position:fixed;inset:0;z-index:500;cursor:crosshair;';
        document.body.appendChild(overlay);

        const onMouseMove = (e: MouseEvent) =>
        {
            // Relay mousemove vers le renderer → déclenche OBJECT_ROLL_OVER
            GetRoomEngine().dispatchMouseEvent(1, e.clientX, e.clientY, MouseEventType.MOUSE_MOVE, e.altKey, e.ctrlKey || e.metaKey, e.shiftKey, false);
        };

        const onMouseDown = () =>
        {
            if(!hoverPos.current) return;

            cornerA.current = { ...hoverPos.current };
            setPreview(buildZone(cornerA.current, cornerA.current));
        };

        const onMouseUp = () =>
        {
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
            hoverPos.current = null;
            setPreview(null);
            setSelecting(false);
        };

        const onKeyDown = (e: KeyboardEvent) =>
        {
            if(e.key === 'Escape')
            {
                cornerA.current = null;
                hoverPos.current = null;
                setPreview(null);
                setSelecting(false);
            }
        };

        overlay.addEventListener('mousemove', onMouseMove);
        overlay.addEventListener('mousedown', onMouseDown);
        overlay.addEventListener('mouseup', onMouseUp);
        window.addEventListener('keydown', onKeyDown);

        return () =>
        {
            overlay.removeEventListener('mousemove', onMouseMove);
            overlay.removeEventListener('mousedown', onMouseDown);
            overlay.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('keydown', onKeyDown);
            document.body.removeChild(overlay);
        };
    }, [ selecting, roomSession ]);

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

    const display = preview ?? { minX, maxX, minY, maxY };
    const hasZone = display.minX !== 0 || display.maxX !== 0 || display.minY !== 0 || display.maxY !== 0;

    return (
        <WiredActionBaseView requiresFurni={ WiredFurniType.STUFF_SELECTION_OPTION_NONE } hasSpecialInput={ true } save={ save }>
            <Column gap={ 2 }>
                <Text bold>Zone de sélection</Text>
                <Button variant={ selecting ? 'primary' : 'secondary' } onClick={ () => setSelecting(v => !v) }>
                    { selecting ? 'Clique et glisse sur la zone...' : 'Sélectionner la zone' }
                </Button>
                { hasZone &&
                    <Column gap={ 1 }>
                        <Text small>X : { display.minX } → { display.maxX }</Text>
                        <Text small>Y : { display.minY } → { display.maxY }</Text>
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
