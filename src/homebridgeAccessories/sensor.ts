import { Characteristic, Service } from '../index';
import { PlatformAccessory, Service as HAPService } from 'homebridge';

const fahrenheitUnit = '°F';

const isTemperatureComponent = (unitOfMeasurement: unknown) =>
    unitOfMeasurement === '°C' || unitOfMeasurement === fahrenheitUnit;

const fahrenheitToCelsius = (fahrenheit: number): number => ((fahrenheit - 32) * 5) / 9;


type SupportedServices =
    | typeof Service.AirQualitySensor
    | typeof Service.CarbonDioxideSensor
    | typeof Service.CarbonMonoxideSensor
    | typeof Service.HumiditySensor
    | typeof Service.LightSensor
    | typeof Service.TemperatureSensor;
type SupportedCharacteristics =
    | typeof Characteristic.AirQuality
    | typeof Characteristic.CarbonDioxideLevel
    | typeof Characteristic.CarbonDioxideDetected
    | typeof Characteristic.CarbonMonoxideLevel
    | typeof Characteristic.CarbonMonoxideDetected
    | typeof Characteristic.CurrentAmbientLightLevel
    | typeof Characteristic.CurrentRelativeHumidity
    | typeof Characteristic.CurrentTemperature
    | typeof Characteristic.NitrogenDioxideDensity
    | typeof Characteristic.OzoneDensity
    | typeof Characteristic.PM10Density
    | typeof Characteristic.PM2_5Density
    | typeof Characteristic.SulphurDioxideDensity
    | typeof Characteristic.VOCDensity;

interface SensorHomekit {
    characteristic: SupportedCharacteristics;
    Service: SupportedServices;
}

type SensorSetupFunction = (
    component: any,
    accessory: PlatformAccessory,
    hk: SensorHomekit | undefined,
    config: any,
) => void;

interface SensorSetupMap {
    setupFunction: SensorSetupFunction | undefined;
    sensorHomekit: SensorHomekit | undefined;
}

const map = (): Map<string, SensorSetupMap> => {
    return new Map<string, SensorSetupMap>([
        [
            'aqi',
            {
                setupFunction: undefined,
                sensorHomekit: {
                    characteristic: Characteristic.AirQuality,
                    Service: Service.AirQualitySensor,
                },
            },
        ],
        [
            'carbon_dioxide',
            {
                setupFunction: co2Setup,
                sensorHomekit: undefined,
            },
        ],
        [
            'carbon_monoxide',
            {
                setupFunction: coSetup,
                sensorHomekit: undefined,
            },
        ],
        [
            'humidity',
            {
                setupFunction: undefined,
                sensorHomekit: {
                    characteristic: Characteristic.CurrentRelativeHumidity,
                    Service: Service.HumiditySensor,
                },
            },
        ],
        [
            'illuminance',
            {
                setupFunction: undefined,
                sensorHomekit: {
                    characteristic: Characteristic.CurrentAmbientLightLevel,
                    Service: Service.LightSensor,
                },
            },
        ],
        [
            'nitrogen_dioxide',
            {
                setupFunction: airQualityComponentSetup,
                sensorHomekit: {
                    characteristic: Characteristic.NitrogenDioxideDensity,
                    Service: Service.AirQualitySensor,
                },
            },
        ],
        [
            'ozone',
            {
                setupFunction: airQualityComponentSetup,
                sensorHomekit: {
                    characteristic: Characteristic.OzoneDensity,
                    Service: Service.AirQualitySensor,
                },
            },
        ],
        [
            'pm25',
            {
                setupFunction: airQualityComponentSetup,
                sensorHomekit: {
                    characteristic: Characteristic.PM2_5Density,
                    Service: Service.AirQualitySensor,
                },
            },
        ],
        [
            'pm10',
            {
                setupFunction: airQualityComponentSetup,
                sensorHomekit: {
                    characteristic: Characteristic.PM10Density,
                    Service: Service.AirQualitySensor,
                },
            },
        ],
        [
            'sulphur_dioxide',
            {
                setupFunction: airQualityComponentSetup,
                sensorHomekit: {
                    characteristic: Characteristic.SulphurDioxideDensity,
                    Service: Service.AirQualitySensor,
                },
            },
        ],
        [
            'temperature',
            {
                setupFunction: undefined,
                sensorHomekit: {
                    characteristic: Characteristic.CurrentTemperature,
                    Service: Service.TemperatureSensor,
                },
            },
        ],
        [
            'volatile_organic_compounds',
            {
                setupFunction: airQualityComponentSetup,
                sensorHomekit: {
                    characteristic: Characteristic.VOCDensity,
                    Service: Service.AirQualitySensor,
                },
            },
        ],
    ]);
};

export const sensorHelper = (component: any, accessory: PlatformAccessory, config: IEsphomePlatformConfig): boolean => {
    const homekitDevice = map().get(component.config.deviceClass as string);
    if (homekitDevice) {
        const homekitSetup = homekitDevice.setupFunction || defaultSetup;
        homekitSetup(component, accessory, homekitDevice.sensorHomekit, config);
        return true;
    }

    // Here for backward compatibility
    if (isTemperatureComponent(component.config.unitOfMeasurement)) {
        defaultSetup(
            component,
            accessory,
            {
                Service: Service.TemperatureSensor,
                characteristic: Characteristic.CurrentTemperature,
            },
            config,
        );
        return true;
    } else if (
        component.config.unitOfMeasurement === '%' &&
        (component.config.icon === 'mdi:water-percent' || component.config.deviceClass === 'humidity')
    ) {
        defaultSetup(
            component,
            accessory,
            {
                Service: Service.HumiditySensor,
                characteristic: Characteristic.CurrentRelativeHumidity,
            },
            config,
        );
        return true;
    }
    return false;
};

const addService = (
    accessory: PlatformAccessory,
    SuppliedService: SupportedServices,
    name: string = '',
    subtype: string = '',
): HAPService => {
    const existingService: HAPService | undefined = accessory.services.find(
        (service) => service.UUID === SuppliedService.UUID,
    );
    if (!existingService) {
        return accessory.addService(new SuppliedService(name, subtype));
    }
    return existingService;
};

const defaultSetup = (
    component: any,
    accessory: PlatformAccessory,
    sensorHomekit: SensorHomekit | undefined,
    _config: IEsphomePlatformConfig,
): void => {
    if (sensorHomekit === undefined) {
        throw new Error('defaultSetup requires a SensorHomekit argument.');
    }
    const existingService = addService(accessory, sensorHomekit.Service, component.name);
    const valuesAreFahrenheit = component.config.unitOfMeasurement === fahrenheitUnit;

    component.on('state', (state: any) => {
        const celsiusValue =
            valuesAreFahrenheit && state.state !== undefined ? fahrenheitToCelsius(state.state) : state.state;
        existingService?.getCharacteristic(sensorHomekit.characteristic)?.setValue(celsiusValue!);
    });
};

const co2Setup = (
    component: any,
    accessory: PlatformAccessory,
    _suppliedService: SensorHomekit | undefined,
    config: any,
): void => {
    return carbonSetup(
        component,
        accessory,
        Service.CarbonDioxideSensor,
        Characteristic.CarbonDioxideLevel,
        Characteristic.CarbonDioxideDetected,
        config.co2Threshold,
    );
};

const coSetup = (
    component: any,
    accessory: PlatformAccessory,
    _suppliedService: SensorHomekit | undefined,
    config: any,
): void => {
    return carbonSetup(
        component,
        accessory,
        Service.CarbonMonoxideSensor,
        Characteristic.CarbonMonoxideLevel,
        Characteristic.CarbonMonoxideDetected,
        config.coThreshold,
    );
};

const carbonSetup = (
    component: any,
    accessory: PlatformAccessory,
    suppliedService: SupportedServices,
    characteristicLevel: SupportedCharacteristics,
    characteristicDetection: SupportedCharacteristics,
    threshold: number | undefined,
): void => {
    // TODO Implement the Peak Level
    const service = addService(accessory, suppliedService, component.name);

    component.on('state', (state: any) => {
        const ppm = state.state;
        service?.getCharacteristic(characteristicLevel)?.setValue(ppm!);
        if (threshold !== undefined) {
            service?.getCharacteristic(characteristicDetection)?.setValue(ppm! > threshold);
        }
    });
};

type AQIFunction = (characteristic: AQI_Characteristics, weight: number) => number;

type AQI_Characteristics =
    | typeof Characteristic.PM10Density
    | typeof Characteristic.PM2_5Density
    | typeof Characteristic.OzoneDensity
    | typeof Characteristic.NitrogenDioxideDensity
    | typeof Characteristic.SulphurDioxideDensity
    | typeof Characteristic.VOCDensity;

const airQualityComponentSetup = (
    component: any,
    accessory: PlatformAccessory,
    suppliedService: SensorHomekit | undefined,
    _config: any,
): void => {
    // TODO UNITS! Only supports um/m3!
    // TODO Being able to choose the AQI function we wanna use
    if (suppliedService === undefined) {
        throw new Error('airQualityComponentSetup requires a SensorHomekit argument.');
    }
    const characteristic = suppliedService.characteristic;

    const existingService = addService(accessory, Service.AirQualitySensor, component.name);
    const aqiFunction: AQIFunction = europeanAQI;

    component.on('state', (state: any) => {
        existingService.getCharacteristic(characteristic)?.setValue(state.state!);
        existingService
            .getCharacteristic(Characteristic.AirQuality)
            ?.setValue(aqiFunction(characteristic, state.state!));
    });
};

const europeanAQI = (characteristic: AQI_Characteristics, weight: number): number => {
    // The "Excellent" rating does not exists in this framework.
    switch (characteristic) {
        case Characteristic.PM2_5Density:
            if (weight < 10) {
                return 2;
            }
            if (weight < 20) {
                return 3;
            }
            if (weight < 25) {
                return 4;
            }
            return 5;
        case Characteristic.PM10Density:
            if (weight < 20) {
                return 2;
            }
            if (weight < 40) {
                return 3;
            }
            if (weight < 50) {
                return 4;
            }
            return 5;
        case Characteristic.OzoneDensity:
            if (weight < 50) {
                return 2;
            }
            if (weight < 100) {
                return 3;
            }
            if (weight < 130) {
                return 4;
            }
            return 5;
        case Characteristic.NitrogenDioxideDensity:
            if (weight < 40) {
                return 2;
            }
            if (weight < 90) {
                return 3;
            }
            if (weight < 120) {
                return 4;
            }
            return 5;
        case Characteristic.SulphurDioxideDensity:
            if (weight < 100) {
                return 2;
            }
            if (weight < 200) {
                return 3;
            }
            if (weight < 350) {
                return 4;
            }
            return 5;
    }
    return 0;
};
