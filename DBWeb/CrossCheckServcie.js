const express = require('express');
const db =require('./DBconnection');
const moment = require('moment-timezone');
const router = express.Router();


router.get('/:table', (req, res) => {
    const table = req.params.table;
    
    // 테이블명에 맞는 쿼리 작성
    let sql = '';
    switch (table) {
    case 'User':
        sql = 'SELECT * FROM User';
        break;
    case 'Device':
        sql = 'SELECT * FROM Device';
        break;
    case 'EnergyUsage':
        sql = 'SELECT * FROM EnergyUsage';
        break;
    case 'Alert':
        sql = 'SELECT * FROM Alert';
        break;
    default:
        return res.status(400).send('잘못된 테이블명입니다.');
    }

    // 데이터베이스 쿼리 실행
    db.query(sql, (err, results) => {
    if (err) {
        console.error('쿼리 오류:', err);
        return res.status(500).send('서버 오류');
    }
    if (table === 'EnergyUsage' || table === 'Alert') {
        results = results.map(row => {
            // 예시: 'date'라는 컬럼을 한국 시간(KST)으로 변환
            if (row.date) {
                // UTC를 KST로 변환
                row.date = moment(row.date).tz('Asia/Seoul').format('YYYY-MM-DD');
            }
            if (row.alertDate) {
                // UTC를 KST로 변환
                row.alertDate = moment(row.alertDate).tz('Asia/Seoul').format('YYYY-MM-DD');
            }
            return row;
        });
    }

      // 결과를 JSON 형식으로 클라이언트에 반환
    res.json(results);
    });
});

module.exports = router;
