import {
    NitroPoint,
    RoomEngine,
    RoomGeometry,
    RoomMapData,
    RoomObjectCategory,
    RoomObjectVariable,
    RoomPlaneData,
    RoomPlaneParser,
    Vector3d,
} from '@nitrots/nitro-renderer';
import { GetRoomEngine } from '../nitro/room/GetRoomEngine';

export interface FloorTilePos
{
    x: number;
    y: number;
}

/**
 * Reproduit {@link RoomSpriteCanvas.handleMouseEvent} → {@link RoomLogic.mouseEvent} :
 * coordonnées écran → point dans l’espace géométrie, puis plancher via {@link RoomPlaneParser}
 * (pas les axes monde (1,0,0)/(0,1,0) arbitraires).
 */
export function floorTileFromScreen(
    roomId: number,
    clientX: number,
    clientY: number,
    parserCache: { mapRef: RoomMapData; parser: RoomPlaneParser } | null,
): { tile: FloorTilePos | null; parserCache: { mapRef: RoomMapData; parser: RoomPlaneParser } | null }
{
    const engine = GetRoomEngine();
    const rc = engine.getRoomInstanceRenderingCanvas(roomId, 1);
    const offset = engine.getRoomInstanceRenderingCanvasOffset(roomId, 1);
    const geometry = engine.getRoomInstanceGeometry(roomId, 1) as RoomGeometry;

    if(!rc || !offset || !geometry) return { tile: null, parserCache };

    const scale = rc.scale || 1;

    // Même convention que RoomSpriteCanvas.createMouseEvent (après handleMouseEvent) :
    // checkMouseHits(Math.trunc((x - screenOffset) / scale), …) puis screenX = x - width/2.
    const xt = Math.trunc((clientX - offset.x) / scale);
    const yt = Math.trunc((clientY - offset.y) / scale);
    const gx = xt - rc.width / 2;
    const gy = yt - rc.height / 2;
    const screenPoint = new NitroPoint(gx, gy);

    const roomObject = engine.getRoomObject(roomId, RoomEngine.ROOM_OBJECT_ID, RoomObjectCategory.ROOM);
    const mapData = roomObject?.model?.getValue<RoomMapData>(RoomObjectVariable.ROOM_MAP_DATA);

    if(!mapData) return { tile: null, parserCache };

    let parser: RoomPlaneParser;
    let nextCache = parserCache;

    if(parserCache && parserCache.mapRef === mapData)
    {
        parser = parserCache.parser;
    }
    else
    {
        parser = new RoomPlaneParser();

        if(!parser.initializeFromMapData(mapData)) return { tile: null, parserCache: null };

        nextCache = { mapRef: mapData, parser };
    }

    for(let planeId = 0; planeId < parser.planeCount; planeId++)
    {
        if(parser.getPlaneType(planeId) !== RoomPlaneData.PLANE_FLOOR) continue;

        const planeLocation = parser.getPlaneLocation(planeId);
        const planeLeftSide = parser.getPlaneLeftSide(planeId);
        const planeRightSide = parser.getPlaneRightSide(planeId);
        const planeNormalDirection = parser.getPlaneNormalDirection(planeId);

        if(!planeLocation || !planeLeftSide || !planeRightSide || !planeNormalDirection) continue;

        const leftSideLength = planeLeftSide.length;
        const rightSideLength = planeRightSide.length;

        if(leftSideLength === 0 || rightSideLength === 0) continue;

        const planePosition = geometry.getPlanePosition(screenPoint, planeLocation, planeLeftSide, planeRightSide);

        if(!planePosition) continue;

        if(!((planePosition.x >= 0) && (planePosition.x < leftSideLength) && (planePosition.y >= 0) && (planePosition.y < rightSideLength))) continue;

        const v = Vector3d.product(planeLeftSide, planePosition.x / leftSideLength);

        v.add(Vector3d.product(planeRightSide, planePosition.y / rightSideLength));
        v.add(planeLocation);

        return {
            tile: {
                x: Math.floor(v.x),
                y: Math.floor(v.y),
            },
            parserCache: nextCache,
        };
    }

    return { tile: null, parserCache: nextCache };
}
