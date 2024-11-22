const express = require('express');
const db =require('./DBconnection');
const router = express.Router();

router.get('/create-device-table', (req, res) => {
    const sql = `CREATE TABLE Device (
        deviceId INT AUTO_INCREMENT PRIMARY KEY,
        userId INT,
        deviceType VARCHAR(50),
        energyRating INT,
        powerConsumption FLOAT,
        FOREIGN KEY (userId) REFERENCES User(userId) ON DELETE CASCADE
    )`;

    db.query(sql, (err, result) => {
        if (err) {
            if (err.code === 'ER_TABLE_EXISTS_ERROR') {
                console.log('Device 테이블이 이미 존재합니다.');
            } else {
            console.error('테이블 생성 실패:', err);
            }
        } else {
            console.log('Device 테이블이 생성되었습니다.');
        }
    });
    res.status(200).send('요청이 완료되었습니다.');
});

router.get('/findAllDevice', async (req, res) => {
    const userId = req.query.userId;  // 쿼리 파라미터에서 userId 가져오기

    if (!userId) {
        return res.status(400).json({ message: 'userId가 필요합니다.' });
    }

    const sql = 'SELECT * FROM Device WHERE userId = ?';

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('쿼리 오류:', err);  // 서버 로그에 에러 기록
            return res.status(500).send('서버 오류');
        }

        if (results.length === 0) {
            return res.status(200).json([]);
        }

        // 결과가 있으면 JSON 형식으로 반환
        res.json(results);
    });
});

router.post('/registerDevice', async (req, res) => {
    const { deviceType, powerConsumption, energyRating } = req.body;
    const userId = req.query.userId;

    if(isNaN(powerConsumption) || powerConsumption <= 0) {
        return res.status(400).send('전력 소배량은 0보다 큰 값이어야 합니다.');
    }

    if (isNaN(energyRating) || energyRating < 1 || energyRating > 5) {
        return res.status(400).send('에너지 등급은 1-5 사이의 숫자만 입력 가능합니다.');
    }

    const sql = 'INSERT INTO Device (userId, deviceType, energyRating, powerConsumption) VALUES (?, ?, ?, ?)';
    db.query(sql, [userId, deviceType, energyRating, powerConsumption], (err, result) => {
        if (err) {
            return res.status(500).send('기기 등록 실패.');
        }
        res.status(201).send('기기 등록이 완료되었습니다!')
    });
});

module.exports = router;