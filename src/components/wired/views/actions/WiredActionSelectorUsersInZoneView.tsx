import { FC, useEffect, useRef, useState } from 'react';
import { GetRoomEngine, WiredFurniType } from '../../../../api';
import { Button, Column, Flex, Text } from '../../../../common';
import { useObjectRollOverEvent, useObjectSelectedEvent, useWired } from '../../../../hooks';
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

    const cornerA = useRef<TilePos | null>(null);
    const cornerB = useRef<TilePos | null>(null);
    const isDragging = useRef(false);

    const { trigger = null, setIntParams = null, setStringParam = null } = useWired();

    const save = () =>
    {
        setIntParams([ minX, maxX, minY, maxY ]);
        setStringParam(JSON.stringify({ minX, maxX, minY, maxY, invert, filterExisting: false }));
    };

    const tileFromEvent = (event: any): TilePos | null =>
    {
        const obj = GetRoomEngine().getRoomObject(event.roomId, event.id, event.category);

        if(!obj) return null;

        const pos = obj.getLocation();

        return { x: Math.floor(pos.x), y: Math.floor(pos.y) };
    };

    const buildZone = (a: TilePos, b: TilePos): ZoneConfig => ({
        minX: Math.min(a.x, b.x),
        maxX: Math.max(a.x, b.x),
        minY: Math.min(a.y, b.y),
        maxY: Math.max(a.y, b.y),
        invert,
        filterExisting: false,
    });

    // Clic dans la room → coin A
    useObjectSelectedEvent(event =>
    {
        if(!selecting) return;

        const tile = tileFromEvent(event);

        if(!tile) return;

        cornerA.current = tile;
        cornerB.current = tile;
        isDragging.current = true;
        setPreview(buildZone(tile, tile));
    });

    // Survol → update coin B + preview
    useObjectRollOverEvent(event =>
    {
        if(!selecting || !isDragging.current || !cornerA.current) return;

        const tile = tileFromEvent(event);

        if(!tile) return;

        cornerB.current = tile;
        setPreview(buildZone(cornerA.current, tile));
    });

    // Mouseup → finalise la sélection
    useEffect(() =>
    {
        if(!selecting) return;

        const onMouseUp = () =>
        {
            if(!isDragging.current) return;

            isDragging.current = false;

            const a = cornerA.current;
            const b = cornerB.current ?? cornerA.current;

            if(a)
            {
                const zone = buildZone(a, b!);

                setMinX(zone.minX);
                setMaxX(zone.maxX);
                setMinY(zone.minY);
                setMaxY(zone.maxY);
            }

            cornerA.current = null;
            cornerB.current = null;
            setPreview(null);
            setSelecting(false);
        };

        document.addEventListener('mouseup', onMouseUp);

        return () => document.removeEventListener('mouseup', onMouseUp);
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
