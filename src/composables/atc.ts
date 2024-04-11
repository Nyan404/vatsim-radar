import type { VatsimShortenedController } from '~/types/data/vatsim';

export const useFacilitiesIds = () => {
    const dataStore = useDataStore();

    return {
        ATIS: -1,
        OBS: dataStore.vatsim.data.facilities.value.find(x => x.short === 'OBS')?.id ?? -1,
        FSS: dataStore.vatsim.data.facilities.value.find(x => x.short === 'FSS')?.id ?? -1,
        DEL: dataStore.vatsim.data.facilities.value.find(x => x.short === 'DEL')?.id ?? -1,
        GND: dataStore.vatsim.data.facilities.value.find(x => x.short === 'GND')?.id ?? -1,
        TWR: dataStore.vatsim.data.facilities.value.find(x => x.short === 'TWR')?.id ?? -1,
        APP: dataStore.vatsim.data.facilities.value.find(x => x.short === 'APP')?.id ?? -1,
        CTR: dataStore.vatsim.data.facilities.value.find(x => x.short === 'CTR')?.id ?? -1,
    };
};

export function getControllerPositionColor(controller: VatsimShortenedController) {
    const ids = useFacilitiesIds();

    if (controller.isATIS) {
        return radarColors.warning600;
    }

    if (controller.facility === ids.DEL) {
        return radarColors.primary600;
    }

    if (controller.facility === ids.TWR) {
        return radarColors.error500;
    }

    if (controller.facility === ids.GND) {
        return radarColors.success500;
    }

    return radarColors.neutral800;
}

export function sortControllersByPosition<T extends {facility: number, [key: string]: any}>(facilities: T[]): T[] {
    const ids = useFacilitiesIds();

    const getPositionIndex = (position: number) => {
        if (position === ids.DEL) return 0;
        if (position === ids.GND) return 1;
        if (position === ids.TWR) return 2;
        if (position === ids.ATIS) return 3;
        return 3;
    };

    return facilities.slice().sort((a, b) => {
        return getPositionIndex(a.facility) > getPositionIndex(b.facility) ? 1 : -1;
    });
}
