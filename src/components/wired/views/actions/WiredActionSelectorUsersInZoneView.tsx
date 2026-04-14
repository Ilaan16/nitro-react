import { FC, useEffect, useState } from 'react';
import { GetRoomEngine, WiredFurniType } from '../../../../api';
import { Button, Column, Flex, Text } from '../../../../common';
import { useObjectSelectedEvent, useWired } from '../../../../hooks';
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

type SelectionTarget = 'minX' | 'maxX' | 'minY' | 'maxY' | null;

export const WiredActionSelectorUsersInZoneView: FC<{}> = props =>
{
    const [ minX, setMinX ] = useState(0);
    const [ maxX, setMaxX ] = useState(0);
    const [ minY, setMinY ] = useState(0);
    const [ maxY, setMaxY ] = useState(0);
    const [ invert, setInvert ] = useState(false);
    const [ selecting, setSelecting ] = useState<SelectionTarget>(null);
    const { trigger = null, setIntParams = null, setStringParam = null } = useWired();

    const save = () =>
    {
        setIntParams([ minX, maxX, minY, maxY ]);
        setStringParam(JSON.stringify({ minX, maxX, minY, maxY, invert, filterExisting: false }));
    };

    useObjectSelectedEvent(event =>
    {
        if(!selecting) return;

        const roomObject = GetRoomEngine().getRoomObject(event.roomId, event.id, event.category);

        if(!roomObject) return;

        const pos = roomObject.getLocation();
        const x = Math.floor(pos.x);
        const y = Math.floor(pos.y);

        switch(selecting)
        {
            case 'minX': setMinX(x); break;
            case 'maxX': setMaxX(x); break;
            case 'minY': setMinY(y); break;
            case 'maxY': setMaxY(y); break;
        }

        setSelecting(null);
    });

    useEffect(() =>
    {
        if(!trigger) return;

        if(trigger.intData.length >= 4)
        {
            setMinX(trigger.intData[0]);
            setMaxX(trigger.intData[1]);
            setMinY(trigger.intData[2]);
            setMaxY(trigger.intData[3]);
        }

        try
        {
            if(trigger.stringData)
            {
                const config: ZoneConfig = JSON.parse(trigger.stringData);

                setInvert(config.invert ?? false);
            }
        }
        catch {}
    }, [ trigger ]);

    const label = (target: SelectionTarget, val: number, axis: string) =>
    {
        if(selecting === target) return 'Cliquez sur une case...';

        return `${axis} : ${val}`;
    };

    return (
        <WiredActionBaseView requiresFurni={ WiredFurniType.STUFF_SELECTION_OPTION_NONE } hasSpecialInput={ true } save={ save }>
            <Column gap={ 2 }>
                <Text bold>Zone de sélection</Text>
                <Flex gap={ 1 }>
                    <Button variant={ selecting === 'minX' ? 'primary' : 'secondary' } onClick={ () => setSelecting(selecting === 'minX' ? null : 'minX') }>
                        { label('minX', minX, 'X min') }
                    </Button>
                    <Button variant={ selecting === 'maxX' ? 'primary' : 'secondary' } onClick={ () => setSelecting(selecting === 'maxX' ? null : 'maxX') }>
                        { label('maxX', maxX, 'X max') }
                    </Button>
                </Flex>
                <Flex gap={ 1 }>
                    <Button variant={ selecting === 'minY' ? 'primary' : 'secondary' } onClick={ () => setSelecting(selecting === 'minY' ? null : 'minY') }>
                        { label('minY', minY, 'Y min') }
                    </Button>
                    <Button variant={ selecting === 'maxY' ? 'primary' : 'secondary' } onClick={ () => setSelecting(selecting === 'maxY' ? null : 'maxY') }>
                        { label('maxY', maxY, 'Y max') }
                    </Button>
                </Flex>
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
