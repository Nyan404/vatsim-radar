import type { InfluxFlight } from '~/utils/backend/influx/queries';
import { getInfluxOnlineFlightTurns } from '~/utils/backend/influx/queries';
import { colorsList } from '~/utils/backend/styles';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { radarStorage } from '~/utils/backend/storage';
import { readFileSync, writeFileSync } from 'node:fs';
import type { VatsimPilot } from '~/types/data/vatsim';
import { join } from 'path';

export interface VatsimPilotConnection {
    id: number;
    vatsim_id: number;
    type: number;
    rating: number;
    callsign: number;
    start: string;
    end: string | null;
    server: string;
}

export type InfluxGeojson = {
    flightPlanTime: string;
    features: FeatureCollection<Point>[];
};

export function getGeojsonForData(rows: InfluxFlight[], flightPlanStart: string): InfluxGeojson {
    function getRowColor(row: InfluxFlight) {
        let rowColor = colorsList.warning500;

        if (row?.altitude) {
            if (row.altitude < 5000) {
                rowColor = colorsList.success400;
            }
            else if (row.altitude < 10000) {
                rowColor = colorsList.success600;
            }
            else if (row.altitude < 15000) {
                rowColor = colorsList.primary500;
            }
            else if (row.altitude < 20000) {
                rowColor = colorsList.primary700;
            }
            else if (row.altitude < 25000) {
                rowColor = colorsList.info400;
            }
            else if (row.altitude < 30000) {
                rowColor = colorsList.info500;
            }
            else if (row.altitude > 40500) {
                rowColor = colorsList.error300;
            }
            else if (row.altitude > 50000) {
                rowColor = colorsList.error700;
            }
            else {
                rowColor = colorsList.info700;
            }
        }
        else rowColor = colorsList.success500;

        return rowColor;
    }

    const geoRows: Feature<Point>[] = rows.filter(x => x.latitude && x.longitude).map(row => ({
        type: 'Feature',
        properties: {
            type: 'turn',
            standing: row.groundspeed !== undefined && row.groundspeed !== null && row.groundspeed < 50,
            coordinates: [
                row.longitude!,
                row.latitude!,
            ],
            timestamp: row._time,
            color: getRowColor(row),
        },
        geometry: {
            type: 'Point',
            coordinates: [
                row.longitude!,
                row.latitude!,
            ],
        },
    }));

    const rowsGroups: FeatureCollection<Point>[] = [];

    for (const row of geoRows) {
        const lastGroup = rowsGroups[rowsGroups.length - 1];
        if (lastGroup && lastGroup.features[0].properties!.color === row.properties!.color) {
            lastGroup.features.push(row);
        }
        else {
            rowsGroups.push({
                type: 'FeatureCollection',
                features: [row],
            });
        }
    }

    return {
        flightPlanTime: flightPlanStart,
        features: rowsGroups,
    };
}

export async function getInfluxOnlineFlightTurnsGeojson(cid: string, start?: string): Promise<InfluxGeojson | null> {
    const rows = await getInfluxOnlineFlightTurns(cid, start);
    if (!rows?.features.length) return null;

    return getGeojsonForData(rows.features, rows.flightPlanStart);
}

function outputInfluxValue(value: string | number | boolean) {
    if (typeof value === 'string') return `"${ value.replaceAll('"', '\\"') }"`;
    if (typeof value === 'number') {
        if (!value.toString().includes('.')) return `${ value }i`;
        return value;
    }
    if (typeof value === 'boolean') return String(value);
}

let previousPlanData: VatsimPilot[] = [];
let previousShortData: VatsimPilot[] = [];

const cwd = join(process.cwd(), 'src');
const dataPath = join(cwd, 'data/turns-save.json');
let file: string | undefined;

try {
    file = readFileSync(dataPath, 'utf-8');
}
catch { // empty
}

if (file) {
    previousPlanData = JSON.parse(file);
    previousShortData = previousPlanData;
}

export function getPlanInfluxDataForPilots() {
    const date = `${ Date.now() }000000`;

    const data = radarStorage.vatsim.data!.pilots.filter(x => x.cid && x.callsign && x.altitude).map(pilot => {
        const previousPilot = previousPlanData.find(x => x.cid === pilot.cid);

        const obj = {
            altitude: pilot.altitude,
            callsign: pilot.callsign,
            groundspeed: pilot.groundspeed,
            heading: pilot.heading,
            latitude: pilot.latitude,
            longitude: pilot.longitude,
            name: pilot.name,
            qnh_mb: pilot.qnh_mb,
            transponder: pilot.transponder,
            fpl_route: pilot.flight_plan?.route,
            fpl_enroute_time: pilot.flight_plan?.enroute_time,
            fpl_flight_rules: pilot.flight_plan?.flight_rules,
            fpl_departure: pilot.flight_plan?.departure,
            fpl_arrival: pilot.flight_plan?.arrival,
            fpl_altitude: pilot.flight_plan?.altitude,
        };

        const someMissing = false;

        if (previousPilot && !!previousPilot.flight_plan?.route === !!obj.fpl_route && previousPilot.callsign === obj.callsign && previousPilot.flight_plan?.arrival === obj.fpl_arrival && previousPilot.flight_plan?.departure === obj.fpl_departure) return;

        const entries = Object.entries(obj)
            .filter(([key, value]) => value !== undefined && value !== null)
            .map(([key, value]) => `${ key }=${ outputInfluxValue(value!) }`)
            .join(',');

        if (!entries || someMissing) return;

        return `data,cid=${ pilot.cid } ${ entries } ${ date }`;
    }).filter(x => !!x) as string[];

    writeFileSync(dataPath, JSON.stringify(radarStorage.vatsim.data!.pilots), 'utf-8');
    previousPlanData = radarStorage.vatsim.data!.pilots;

    return data;
}

export function getShortInfluxDataForPilots() {
    const date = `${ Date.now() }000000`;

    const data = radarStorage.vatsim.data!.pilots.filter(x => x.cid && x.callsign && x.altitude).map(pilot => {
        const previousPilot = previousShortData.find(x => x.cid === pilot.cid);

        const obj = {
            altitude: pilot.altitude,
            callsign: pilot.callsign,
            groundspeed: pilot.groundspeed,
            heading: pilot.heading,
            latitude: pilot.latitude,
            longitude: pilot.longitude,
            name: pilot.name,
            qnh_mb: pilot.qnh_mb,
            transponder: pilot.transponder,
        };

        const previousObj = previousPilot && {
            altitude: previousPilot.altitude,
            callsign: previousPilot.callsign,
            groundspeed: previousPilot.groundspeed,
            heading: previousPilot.heading,
            latitude: previousPilot.latitude,
            longitude: previousPilot.longitude,
            name: previousPilot.name,
            qnh_mb: previousPilot.qnh_mb,
            transponder: previousPilot.transponder,
        };

        const entries = Object.entries(obj)
            .filter(([key, value]) => value !== undefined && value !== null && (!previousObj || previousObj[key as keyof typeof previousObj] !== value))
            .map(([key, value]) => `${ key }=${ outputInfluxValue(value!) }`)
            .join(',');

        if (!entries) return;

        return `data,cid=${ pilot.cid } ${ entries } ${ date }`;
    }).filter(x => !!x) as string[];

    writeFileSync(dataPath, JSON.stringify(radarStorage.vatsim.data!.pilots), 'utf-8');
    previousShortData = radarStorage.vatsim.data!.pilots;

    return data;
}
