const express = require('express');
const db =require('./DBconnection');
const router = express.Router();

router.get('/create-alert-table', (req, res) => {
    const sql = `CREATE TABLE Alert (
        alertId INT AUTO_INCREMENT PRIMARY KEY,
        userId INT,
        deviceId INT,
        alertDate DATE,
        alertType INT,
        resolved BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (deviceId) REFERENCES Device(deviceId) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES User(userId) ON DELETE CASCADE
    )`;

    db.query(sql, (err, result) => {
        if (err) {
            if (err.code === 'ER_TABLE_EXISTS_ERROR') {
                console.log('Alert 테이블이 이미 존재합니다.');
            } else {
            console.error('테이블 생성 실패:', err);
            }
        } else {
            console.log('Alert 테이블이 생성되었습니다.');
        }
    });
    res.status(200).send('요청이 완료되었습니다.');
});

function alertMent(alertType, deviceId, deviceType) {
    switch (alertType) {
        case 1:
            return "이번 달 사용량이 10kWh를 초과했습니다. 에너지 절약을 고려해보세요.";
        case 2:
            return "이번 달 예상 전기 요금이 30,000원을 초과했습니다. 사용 패턴을 점검해보세요.";
        case 3:
            return `기기 번호 ${deviceId}(${deviceType})가(이) 한 달간 사용되지 않았습니다. 필요 없는 기기라면 제거를 고려해보세요.`;
        case 4:
            return `기기 번호 ${deviceId}(${deviceType})가(이) 평균 사용량보다 30% 더 높은 전력을 소비 중입니다. 점검을 권장합니다.`;
        default:
            return "해당 알람이 없습니다.";
    }
}

// 평균 사용량 계산 함수
function averageUsage(deviceId, callback) {
    const sql = `SELECT d.powerConsumption, e.usageHours
                FROM Device d
                JOIN EnergyUsage e ON d.deviceId = e.deviceId
                WHERE d.deviceId = ?`;
    db.query(sql, [deviceId], (err, results) => {
        if (err) {
            console.error('평균 계산 함수에서 디비 조회 중 에러: ',err);
            return callback(0); // 오류 발생 시 0 반환
        }

        let totalEnergyUsage = 0;
        let count = 0;
        results.forEach(row => {
            const powerConsumption = row.powerConsumption;
            const usageHours = row.usageHours;
            totalEnergyUsage += (powerConsumption * usageHours);
            count++;
        });

        callback(count > 0 ? totalEnergyUsage / count : 0);
    });
}
// 한 달간 사용 내역 조회
function isUsedThisMonth(usageDate) {
    const currentDate = new Date();
    const oneMonthAgo = new Date(currentDate.setMonth(currentDate.getMonth() - 1));
    const usageLocalDate = new Date(usageDate);
    return usageLocalDate >= oneMonthAgo;
}

function generateAlert(userId, deviceId, alertType, callback) {
    const currentDate = new Date();
    const startDate = alertType === 1 || alertType === 2 || alertType === 3 ? new Date(currentDate.getFullYear(), currentDate.getMonth(), 1) : new Date(currentDate.setDate(currentDate.getDate() - 1));
    const checkSql = `SELECT COUNT(*) AS alertCount FROM Alert WHERE userId = ? AND deviceId = ? AND alertType = ? AND alertDate >= ?`;
    
    db.query(checkSql, [userId, deviceId, alertType, startDate], (err, results) => {
        if (err) {
            console.error('알람 생성 함수에서 디비 조회 중 에러: ',err);
            return callback(err);
        }

        if ((alertType === 1 || alertType === 2 || alertType === 3 || alertType === 4) && results[0].alertCount > 0) {
            return ;
        }

        const insertSql = `INSERT INTO Alert (userId, deviceId, alertDate, alertType, resolved)
                        VALUES (?, ?, CURRENT_DATE, ?, false)`;
        db.query(insertSql, [userId, deviceId, alertType], (insertErr, insertResult) => {
            if (insertErr) {
                console.error('디비에 알람 추가 중 에러: ',insertErr);
                return callback(insertErr);
            }
            callback(null);
        });
    });
}

// 사용자 알람 확인 API
router.get('/checkAndGenerateAlerts', (req, res) => {
    const userId = req.query.userId;
    const sql = "SELECT deviceId, powerConsumption FROM Device WHERE userId = ?";
    
    db.query(sql, [userId], (err, deviceResults) => {
        if (err) {
            console.error('Device 조회 중 오류 발생:', err);
            return res.status(500).send('Device 데이터를 가져오는 중 오류가 발생했습니다.');
        }

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // 월은 0부터 시작하므로 +1

        deviceResults.forEach(device => {
            const deviceId = device.deviceId;
            const powerConsumption = device.powerConsumption;
            
            averageUsage(deviceId, (avgUsage) => {
                const usageSql = "SELECT usageHours, cost, date FROM EnergyUsage WHERE deviceId = ? AND MONTH(date) = ?";
                db.query(usageSql, [deviceId, currentMonth], (usageErr, usageResults) => {
                    if (usageErr) {
                        console.error('EnergyUsate 조회 중 오류 발생: ', usageErr)
                        return res.status(500).send('EnergyUsage 데이터를 가져오는 중 오류가 발생했습니다.');
                    }

                    let totalEnergyUsage = 0;
                    let totalCost = 0;
                    let usedThisMonth = false;

                    usageResults.forEach(usage => {
                        const usageHours = usage.usageHours;
                        const cost = usage.cost;
                        const date = usage.date;

                        if (isUsedThisMonth(date)) {
                            usedThisMonth = true;
                        }

                        totalCost += cost;
                        totalEnergyUsage += powerConsumption * usageHours;
                    });

                    // 알람 조건 체크
                    if (totalEnergyUsage > avgUsage * 1.3) {
                        generateAlert(userId, deviceId, 4, (genErr, msg) => {
                            if (genErr) return console.error(genErr);
                            console.log(msg);
                        });
                    }
                    if (totalCost > 30000) {
                        generateAlert(userId, deviceId, 2, (genErr, msg) => {
                            if (genErr) return console.error(genErr);
                            console.log(msg);
                        });
                    }
                    if (totalEnergyUsage > 10) {
                        generateAlert(userId, deviceId, 1, (genErr, msg) => {
                            if (genErr) return console.error(genErr);
                            console.log(msg);
                        });
                    }
                    if (!usedThisMonth) {
                        generateAlert(userId, deviceId, 3, (genErr, msg) => {
                            if (genErr) return console.error(genErr);
                            console.log(msg);
                        });
                    }
                });
            });
        });
        
        res.status(200).send('알림 확인 완료');
    });
});

router.get('/displayAlerts', (req, res) => {
    const userId = req.query.userId;

    const sql =`
        SELECT a.alertId, a.alertType, a.deviceId, d.deviceType
        FROM Alert a
        JOIN Device d ON a.deviceId = d.deviceId
        WHERE a.userId = ? AND a.resolved = FALSE
    `;

    db.query(sql, [userId], (err, results) => {
        if(err) {
            console.error('알림 조회 중 오류 발생: ', err);
            return res.status(500).send('알람 데이터를 가져오는 중 오류가 발생했습니다.');
        }

        let alerts = [];
        results.forEach(row => {
            const alertMessage = alertMent(row.alertType, row.deviceId, row.deviceType);
            alerts.push({
                alertId: row.alertId,
                message: alertMessage
            });
        });

        res.status(200).json(alerts);
    });
});

router.post('/resolveAlert', (req, res) => {
    const alertId = req.body.alertId;  // 클라이언트에서 POST로 받은 alertId
    const userId = req.query.userId;


    if (!alertId) {
        return res.status(400).send('알람 번호를 입력하세요.');
    }

    const sql = "UPDATE Alert SET resolved = TRUE WHERE alertId = ? AND userId = ?";

    db.query(sql, [alertId, userId], (err, results) => {
        if (err) {
            console.error('알람 읽음 처리 중 오류 발생: ', err);
            return res.status(500).send('알람 읽음 처리 중 오류가 발생했습니다.');
        }

        if (results.affectedRows > 0) {
            return res.status(200).send(`알람 번호 ${alertId}번을 읽음 처리 하였습니다.`);
        } else {
            return res.status(404).send('해당 알람을 찾을 수 없거나, 권한이 없습니다.');
        }
    });
});

module.exports = router;