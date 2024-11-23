const express = require('express');
const db =require('./DBconnection');
const router = express.Router();

router.get('/create-energyusage-table', (req, res) => {
    const sql = `CREATE TABLE EnergyUsage (
        energy_usageId INT AUTO_INCREMENT PRIMARY KEY,
        deviceId INT, 
        date DATE,
        usageHours FLOAT,
        cost FLOAT,
        FOREIGN KEY (deviceId) REFERENCES Device(deviceId) ON DELETE CASCADE
    )`;

    db.query(sql, (err, result) => {
        if (err) {
            if (err.code === 'ER_TABLE_EXISTS_ERROR') {
                console.log('EnergyUsage 테이블이 이미 존재합니다.');
            } else {
            console.error('테이블 생성 실패:', err);
            }
        } else {
            console.log('EnergyUsage 테이블이 생성되었습니다.');
        }
    });
    res.status(200).send('요청이 완료되었습니다.');
});

router.post('/addEnergyUsage', async (req, res) => {
    const { deviceId, date, usageHours } = req.body;
    const userId = req.query.userId; // userId는 쿼리 파라미터로 전달

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(date)) {
    return res.status(404).send('날짜 형식이 잘못되었습니다. 형식: yyyy-MM-dd');
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime()) || dateObj.toISOString().slice(0, 10) !== date) {
        return res.status(404).send('유효하지 않은 날짜입니다.');
    }

    try {
        // 기기가 사용자의 소유인지 확인
        const checkSql = 'SELECT COUNT(*) AS count FROM Device WHERE deviceId = ? AND userId = ?';
        db.query(checkSql, [deviceId, userId], (err, result) => {
            if (err) {
                console.error('소유 확인 중 오류:', err);
                return res.status(500).send('기기 소유 확인 중 오류가 발생했습니다.');
            }

            if (result[0].count === 0) {
                return res.status(403).send('입력한 기기는 사용자의 소유가 아닙니다. 출력된 기기 리스트에서 선택해주세요.');
            }

            // 소유 확인 완료 후 처리 시작
            const deviceQuery = 'SELECT powerConsumption, energyRating FROM Device WHERE deviceId = ?';
            db.query(deviceQuery, [deviceId], (err, deviceResult) => {
                if (err) {
                    console.error('기기 정보 조회 오류:', err);
                    return res.status(500).send('기기 정보 조회 중 오류가 발생했습니다.');
                }

                if (deviceResult.length === 0) {
                    return res.status(404).send('해당 deviceId에 해당하는 기기를 찾을 수 없습니다.');
                }

                const { powerConsumption, energyRating } = deviceResult[0];

                // 에너지 등급에 따른 kWh 가격 계산 함수
                const getPricePerKWh = (energyRating) => {
                    switch (energyRating) {
                        case 1: return 100.0;
                        case 2: return 150.0;
                        case 3: return 200.0;
                        case 4: return 250.0;
                        case 5: return 300.0;
                        default: return 0.0;
                    }
                };

                // 비용 계산
                const cost = powerConsumption * getPricePerKWh(energyRating) * usageHours;

                // EnergyUsage 테이블에 데이터 삽입
                const insertSql = 'INSERT INTO EnergyUsage (deviceId, date, usageHours, cost) VALUES (?, ?, ?, ?)';
                db.query(insertSql, [deviceId, date, usageHours, cost], (err, insertResult) => {
                    if (err) {
                        console.error('에너지 사용 기록 추가 오류:', err);
                        return res.status(500).send('에너지 사용 기록 추가 중 오류가 발생했습니다.');
                    }

                    updateAlertAfterUsage(deviceId, userId, date, (updateErr, message) => {
                        if (updateErr) {
                            console.error('알람 해결 처리 중 오류: ', updateErr);
                            return res.status(500).send('알람 해결 처리 중 오류가 발생했습니다.');
                        }

                        res.status(201).send('사용 기록 등록이 완료되었습니다!')
                    });
                });
            });
        });
    } catch (err) {
        console.error('예기치 못한 오류:', err);
        res.status(500).send('서버에서 오류가 발생했습니다.');
    }
});

function updateAlertAfterUsage(deviceId, userId, usageDate, callback) {
    // 현재 월과 연도 계산
    const currentDate = new Date(usageDate);
    const month = currentDate.getMonth() + 1; // JavaScript에서 월은 0부터 시작하므로 1을 더함
    const year = currentDate.getFullYear();

    // 기기 사용량이 있는지 확인하는 SQL 쿼리
    const checkSql = 'SELECT COUNT(*) AS count FROM EnergyUsage WHERE deviceId = ? AND MONTH(date) = ? AND YEAR(date) = ?';

    db.execute(checkSql, [deviceId, month, year], (err, results) => {
        if (err) {
            console.error('쿼리 실행 중 에러: ', err);
            return callback(err);
        }

        // 기기 사용량이 추가되었으면 알람 해결 처리
        if (results[0].count > 0) {
            const updateSql = 'UPDATE Alert SET resolved = TRUE WHERE userId = ? AND deviceId = ? AND alertType = ?';

            db.execute(updateSql, [userId, deviceId, 3], (updateErr, updateResults) => {
                if (updateErr) {
                    console.error('알람 해결 처리 중 에러: ', updateErr);
                    return callback(updateErr);
                }

                console.log('알람 해결 처리 성공');
                callback(null, '기기 미사용 알람이 해결되었습니다.');
            });
        } else {
            console.log('기기 사용량이 추가되지 않았습니다.');
            callback(null, '기기 사용량이 없으므로 알람을 해결하지 않았습니다.');
        }
    });
}

router.get('/monthlyUsage', async (req, res) => {
    const userId = req.query.userId;
    const month = req.query.month;

    if (!userId || !month || month < 1 || month > 12) {
        return res.status(400).send('유효한 userId와 1에서 12 사이의 month 값을 제공해야 합니다.');
    }

    let totalMonthlyUsage = 0.0;

    const deviceSql = 'SELECT deviceId, powerConsumption FROM Device WHERE userId = ?';
    db.query(deviceSql, [userId], (err, devices) => {
        if (err) {
            console.error('Device 조회 중 오류 발생:', err);
            return res.status(500).send('Device 데이터를 가져오는 중 오류가 발생했습니다.');
        }

        let completedDevices = 0;

        if (devices.length === 0) {
            return res.status(200).send({
                message: `${month}월 총 전력 사용량`,
                totalMonthlyUsage: `0.00 kWh`,
            });
        }

        devices.forEach((device) => {
            const { deviceId, powerConsumption } = device;

            const usageSql =
                'SELECT usageHours FROM EnergyUsage WHERE deviceId = ? AND MONTH(date) = ?';
            db.query(usageSql, [deviceId, month], (usageErr, usageData) => {
                if (usageErr) {
                    console.error(`Device ID ${deviceId}의 사용량 조회 중 오류 발생:`, usageErr);
                    return res.status(500).send('사용량 데이터를 가져오는 중 오류가 발생했습니다.');
                }

                let monthlyUsageForDevice = 0.0;

                usageData.forEach(({ usageHours }) => {
                    monthlyUsageForDevice += powerConsumption * usageHours;
                });

                totalMonthlyUsage += monthlyUsageForDevice;

                completedDevices++;

                // 모든 기기에 대한 처리가 완료되면 응답
                if (completedDevices === devices.length) {
                    res.status(200).send({
                        message: `${month}월 총 전력 사용량`,
                        totalMonthlyUsage: `${totalMonthlyUsage.toFixed(2)} kWh`,
                    });
                }
            });
        });
    });
})

module.exports = router;