const mysql = require('mysql2');

const conn = mysql.createConnection({
    host: 'localhost',
    port: 3306, 
    user: 'root',
    password: '', // password
    database: 'energy_management',
});

conn.connect((err) => {
    if (err) {
        console.error('데이터베이스 연결 실패:', err);
        return;
    }
    console.log('연결 성공.');
});

module.exports = conn;
