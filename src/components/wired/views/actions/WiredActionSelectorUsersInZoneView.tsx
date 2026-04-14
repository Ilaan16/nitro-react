import { NitroPoint, RoomGeometry, Vector3d } from '@nitrots/nitro-renderer';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { GetNitroInstance, GetRoomEngine, WiredFurniType } from '../../../../api';
import { Button, Column, Flex, Text } from '../../../../common';
import { useRoom, useWired } from '../../../../hooks';
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
interface PixelPos { px: number; py: number; }

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
    const overlayRef = useRef<HTMLCanvasElement>(null);

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

    // Convertit coordonnées client (clientX/Y) → tuile de grille via géométrie Nitro
    // Formule : geoX = clientX - canvasWidth/2 - screenOffsetX
    // (le renderer centre le repère géométrique au milieu du canvas)
    const tileFromClient = useCallback((clientX: number, clientY: number): TilePos | null =>
    {
        if(!roomSession) return null;

        const engine = GetRoomEngine();
        const offset = engine.getRoomInstanceRenderingCanvasOffset(roomSession.roomId, 1);
        const geometry = engine.getRoomInstanceGeometry(roomSession.roomId, 1) as RoomGeometry;

        if(!offset || !geometry) return null;

        const view = GetNitroInstance().application.renderer.view;
        const halfW = view.width  / 2;
        const halfH = view.height / 2;

        const pos = geometry.getPlanePosition(
            new NitroPoint(clientX - halfW - offset.x, clientY - halfH - offset.y),
            new Vector3d(0, 0, 0),
            new Vector3d(1, 0, 0),
            new Vector3d(0, 1, 0)
        );

        if(!pos) return null;

        return { x: Math.floor(pos.x), y: Math.floor(pos.y) };
    }, [ roomSession ]);

    // Convertit tuile → coordonnées pixel (pour le dessin du rectangle)
    const pixelFromTile = useCallback((x: number, y: number): PixelPos | null =>
    {
        if(!roomSession) return null;

        const engine = GetRoomEngine();
        const offset = engine.getRoomInstanceRenderingCanvasOffset(roomSession.roomId, 1);
        const geometry = engine.getRoomInstanceGeometry(roomSession.roomId, 1) as RoomGeometry;

        if(!offset || !geometry) return null;

        const view = GetNitroInstance().application.renderer.view;
        const halfW = view.width  / 2;
        const halfH = view.height / 2;

        const screenPos = geometry.getScreenPosition(new Vector3d(x, y, 0));

        if(!screenPos) return null;

        return { px: screenPos.x + halfW + offset.x, py: screenPos.y + halfH + offset.y };
    }, [ roomSession ]);

    // Dessine le rectangle isométrique sur le canvas overlay
    const drawRect = useCallback((zone: ZoneConfig | null) =>
    {
        const canvas = overlayRef.current;

        if(!canvas) return;

        const ctx = canvas.getContext('2d');

        if(!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if(!zone) return;

        // 4 coins du rectangle isométrique (z=0, bords inclusifs → +1)
        const corners: PixelPos[] = [
            pixelFromTile(zone.minX,     zone.minY),
            pixelFromTile(zone.maxX + 1, zone.minY),
            pixelFromTile(zone.maxX + 1, zone.maxY + 1),
            pixelFromTile(zone.minX,     zone.maxY + 1),
        ].filter(Boolean) as PixelPos[];

        if(corners.length < 4) return;

        ctx.beginPath();
        ctx.moveTo(corners[0].px, corners[0].py);
        ctx.lineTo(corners[1].px, corners[1].py);
        ctx.lineTo(corners[2].px, corners[2].py);
        ctx.lineTo(corners[3].px, corners[3].py);
        ctx.closePath();

        ctx.fillStyle = 'rgba(0, 170, 255, 0.20)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 170, 255, 0.85)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }, [ pixelFromTile ]);

    // Redessine dès que la zone live change
    useEffect(() =>
    {
        drawRect(liveZone);
    }, [ liveZone, drawRect ]);

    // Gestionnaires souris + setup du mode sélection
    useEffect(() =>
    {
        if(!selecting || !roomSession) return;

        const nitroCanvas = document.querySelector('canvas');

        if(!nitroCanvas) return;

        // Resize l'overlay au canvas Nitro
        const overlay = overlayRef.current;

        if(overlay)
        {
            overlay.width  = window.innerWidth;
            overlay.height = window.innerHeight;
        }

        const onCanvasMouseDown = (e: MouseEvent) =>
        {
            // Bloquer le drag Pixi sans bloquer les clics sur l'UI React
            e.stopImmediatePropagation();

            const tile = tileFromClient(e.clientX, e.clientY);

            if(!tile) return;

            cornerA.current = { ...tile };
            isDragging.current = true;
            setLiveZone(buildZone(tile, tile));
        };

        const onMouseMove = (e: MouseEvent) =>
        {
            const tile = tileFromClient(e.clientX, e.clientY);

            if(!tile) return;

            hoverPos.current = tile;

            if(isDragging.current && cornerA.current)
            {
                setLiveZone(buildZone(cornerA.current, tile));
            }
        };

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
            setLiveZone(null);
            setSelecting(false);
        };

        (nitroCanvas as HTMLElement).style.cursor = 'crosshair';

        // capture: true sur mousedown uniquement → bloque le drag Pixi
        nitroCanvas.addEventListener('mousedown', onCanvasMouseDown, { capture: true });
        // mousemove sur document → calcul de tuile partout (y compris hors canvas)
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        window.addEventListener('keydown', onKeyDown);

        return () =>
        {
            (nitroCanvas as HTMLElement).style.cursor = '';
            nitroCanvas.removeEventListener('mousedown', onCanvasMouseDown, { capture: true } as EventListenerOptions);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('keydown', onKeyDown);

            // Effacer le rectangle quand on quitte le mode
            const canvas = overlayRef.current;

            if(canvas)
            {
                const ctx = canvas.getContext('2d');

                if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        };
    }, [ selecting, roomSession, tileFromClient ]);

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
        <>
            { /* Canvas overlay pour le rectangle isométrique — pointer-events:none = non bloquant */ }
            <canvas
                ref={ overlayRef }
                style={ {
                    position: 'fixed',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 498,
                    display: selecting ? 'block' : 'none',
                } }
            />
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
        </>
    );
}
