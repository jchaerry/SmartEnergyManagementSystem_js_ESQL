const express = require('express');
const session = require('express-session');
const db = require('./DBconnection');
const userService = require('./UserService'); // UserService 라우터
const deviceService = require('./DeviceService');
const energyUsageService = require('./EnergyUsageService');
const alertService = require('./AlertService');
const crossCheckService = require('./CrossCheckServcie');
const path = require('path');

const app = express();
const port = 3000;

app.use(session({
    secret: '147852369', // 비밀 키, 쿠키를 암호화하는 데 사용
    resave: false,             // 세션을 항상 저장할지 여부
    saveUninitialized: true,   // 초기화되지 않은 세션도 저장할지 여부
    cookie: { secure: false }  // 로컬 개발 환경에서는 `secure: false`로 설정 (배포시 HTTPS 환경에서는 true로 설정)
}));

app.use(express.json()); // JSON 요청 본문 파싱

// `/` 요청을 Main.html로 리다이렉트
app.get('/', (req, res) => {
    res.redirect('/Main.html');
});

// Service 연결
app.use('/', userService);
app.use('/', deviceService);
app.use('/', energyUsageService);
app.use('/', alertService);
app.use('/CrossCheck', crossCheckService);

// 정적 파일 제공 (HTML 파일 위치 설정)
app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});