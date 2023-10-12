ymaps.ready(init);

function calculateRouteWithStop(startPoint, endPoint, stopPoint, myMap, multiRoute, f, route) {

    // Передаем координаты точек в формате [широта, долгота]
    var points = [startPoint, stopPoint, endPoint];

    if (f){
        myMap.geoObjects.removeAll();
    }

    // Создаем маршрут
    console.log(points)
    var multiRoute1 = new ymaps.multiRouter.MultiRoute({
        referencePoints: points,
        params: {
            routingMode: 'auto'
        }
    }, {
        boundsAutoApply: true
    });

    // Добавляем маршрут на карту
    myMap.geoObjects.add(multiRoute1)
    route.setActiveRoute(multiRoute1)
        }

// Функция для поиска ближайшей электрозаправки
function findNearestChargingStation(startPoint, endPoint, myMap, activeRoute, f, route) {
    // Ваш API-ключ для доступа к сервису поиска по организациям Яндекса
    var apiKey = '200abc5d-c1ed-4b8e-a752-29a2feb5fe61';

    // Параметры запроса
    var params = {
        apikey: apiKey,
        text: 'Станция зарядки электромобилей',
        lang: 'ru_RU',
        ll: [startPoint[1],startPoint[0]].join(','),
        spn: '2, 2',
        results: 1
    };
    console.log(params)

    // Формируем URL для запроса с параметрами
    var apiUrl = 'https://search-maps.yandex.ru/v1/?' + new URLSearchParams(params).toString();

    // Выполняем запрос к API
    fetch(apiUrl, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            // Обработка результатов
            if (data.features && data.features.length > 0) {
                var feature = data.features[0];
                var chargingStationCoords = feature.geometry.coordinates;
                chargingStationCoords = [chargingStationCoords[1], chargingStationCoords[0]]
                // Прокладываем маршрут с учетом остановки на ближайшей электрозаправке
                calculateRouteWithStop(startPoint, endPoint, chargingStationCoords, myMap, activeRoute, f, route);
                console.log('Ближайшая электрозаправка: ' + chargingStationCoords);
            } else {
                console.log('Электрозаправок поблизости не обнаружено');
            }
        })
        .catch(error => {
            console.error('Ошибка при поиске ближайшей электрозаправки: ' + error);
        });
}

function init() {
    // Максимальная ёмкость аккумулятора.
    //  Можно брать один раз и записывать в базу данных пользователя, либо запрашивать каждый раз
    //  Указано заявленное значение для автомобилей atom
    var max_accumulator_charge = 77

    //  Средний расход заряда на 100 км (квт в ч на 100 км)
    //  Можно брать один раз и записывать в базу данных пользователя, либо запрашивать каждый раз
    //  Указано заявленное значение для автомобилей atom
    var charge_consumption = 15.4

    //  Заряд аккумулятора на данный момент (нужно запрашивать у автомобиля)
    var accumulator_charge = 70

    var myMap = new ymaps.Map("map", {
        center: [55.755773, 37.617761], // Москва
        zoom: 9
    });

    var route;

    window.buildRoute = function () {
        myMap.geoObjects.removeAll();
        var startAddress = document.getElementById('start_address').value;
        var endAddress = document.getElementById('end_address').value;

        // Геокодируем начальный и конечный адреса
        ymaps.geocode(startAddress).then(function (startGeoObject) {
            startCoords = startGeoObject.geoObjects.get(0).geometry.getCoordinates();
            ymaps.geocode(endAddress).then(function (endGeoObject) {
                endCoords = endGeoObject.geoObjects.get(0).geometry.getCoordinates();

                if (route) {
                    myMap.geoObjects.remove(route);
                }

                // Создаем маршрут
                route = new ymaps.multiRouter.MultiRoute({
                    referencePoints: [startCoords, endCoords],
                    params: {
                        routingMode: 'auto'
                    }
                }, {
                    boundsAutoApply: true
                });

                console.log(startCoords);
                console.log(endCoords);


                route.model.events.add("requestsuccess", function () {
                    if (route) {
                        var activeRoute = route.getActiveRoute();
                        accumulator_charge = parseInt(document.getElementById("charge").value); // Получаем заряд электромобиля из поля
                        var distanceInKiloMeters = activeRoute.properties.get("distance").value / 1000; // Получение расстояния в километрах
                        console.log("Маршрут электромобиля " + distanceInKiloMeters);

                        // Считаем предполагаемую ёмкость аккумулятора после маршрута
                        var planned_charge_after_trip = accumulator_charge - (charge_consumption * distanceInKiloMeters / 100);
                        console.log(planned_charge_after_trip)
                        // Проверяем, достаточно ли заряда автомобиля для поездки (учитывает небольшую погрешность)
                        if (planned_charge_after_trip >= 5) {

                            // Проверяем, опустится ли заряд ниже 20%
                            if (planned_charge_after_trip / max_accumulator_charge < 0.2) {
                                // Если да - то предложить сделать остановку (не обязательную)
                                 findNearestChargingStation(startCoords, endCoords, myMap, activeRoute, false, route)
                                 myMap.geoObjects.add(route);
                            } else {
                                myMap.geoObjects.add(route);
                            }
                        } else {

                            // Если заряда для поездки недостаточно - проложить маршрут с заправкой
                            // Используем сервис геокодирования для поиска электрозаправок
                            findNearestChargingStation(startCoords, endCoords, myMap, activeRoute, true)
                            myMap.geoObjects.add(route);
                        }
                    }
                });


            });
        });
    }
}