const express = require('express');
const db =require('./DBconnection');
const router = express.Router();


router.get('/create-user-table', (req, res) => {
    const sql = `CREATE TABLE User (
        userId INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100),
        phoneNumber VARCHAR(15) UNIQUE,
        password VARCHAR(100)
    )`;

    db.query(sql, (err, result) => {
        if (err) {
            if (err.code === 'ER_TABLE_EXISTS_ERROR') {
                console.log('User 테이블이 이미 존재합니다.');
            } else {
            console.error('테이블 생성 실패:', err);
            }
        } else {
            console.log('User 테이블이 생성되었습니다.');
        }
    });
    res.status(200).send('요청이 완료되었습니다.');
});

router.post('/registerUser', (req, res) => {
    const { name, phoneNumber, password } = req.body;

    const phonePattern = /^\d{3}-\d{4}-\d{4}$/;
    if (!phonePattern.test(phoneNumber)) {
    return res.status(400).send('전화번호 형식이 잘못되었습니다. 형식: 010-xxxx-xxxx');
    }

    const checkSql = 'SELECT * FROM User WHERE phoneNumber = ?';
    db.query(checkSql, [phoneNumber], (err, result) => {
    if (err) {
        return res.status(500).send('유저 찾기에 실패하였습니다.');
    }

    if (result.length > 0) {
        return res.status(400).send('이미 가입된 전화번호입니다.');
    } else {
        const insertSql = 'INSERT INTO User (name, phoneNumber, password) VALUES (?, ?, ?)';
        db.query(insertSql, [name, phoneNumber, password], (err, result) => {
        if (err) {
            return res.status(500).send('회원 등록 실패.');
        }
        res.status(201).send('회원 등록이 완료되었습니다!');
        });
    }
    });
});

router.get('/findUser', (req, res) => {
    const phoneNumber = req.query.phoneNumber;

    const phonePattern = /^\d{3}-\d{4}-\d{4}$/;
    if (!phonePattern.test(phoneNumber)) {
        return res.status(400).send('전화번호 형식이 잘못되었습니다. 형식: 010-xxxx-xxxx');
    }

    const sql = 'SELECT * FROM User WHERE phoneNumber = ?';
    db.query(sql, [phoneNumber], (err, result) => {
    if (err) {
        return res.status(500).send('회원 찾기 실패.');
    }

    if (result.length > 0) {
        res.json(result[0]);
    } else {
        res.status(404).send('해당 번호로 가입된 유저가 없습니다.');
    }
    });
});

router.delete('/deleteUser', (req, res) => {
    const { phoneNumber, password } = req.body;

    const phonePattern = /^\d{3}-\d{4}-\d{4}$/;
    if (!phonePattern.test(phoneNumber)) {
        return res.status(400).send('전화번호 형식이 잘못되었습니다. 형식: 010-xxxx-xxxx');
    }

    const sql = 'SELECT * FROM User WHERE phoneNumber = ?';
    db.query(sql, [phoneNumber], (err, result) => {
    if (err) {
        return res.status(500).send('회원 확인 실패.');
    }

    if (result.length === 0) {
        return res.status(404).send('해당 번호로 가입된 유저가 없습니다.');
    }

    const deleteSql = 'DELETE FROM User WHERE phoneNumber = ? AND password = ?';
    db.query(deleteSql, [phoneNumber, password], (err, result) => {
        if (err) {
        return res.status(500).send('회원 삭제 실패.');
        }

        if (result.affectedRows > 0) {
        res.send('회원 정보가 삭제되었습니다.');
        } else {
        res.status(400).send('비밀번호가 일치하지 않습니다.');
        }
    });
    });
});

router.post('/loginUser', (req, res) => {
    const { phoneNumber, password } = req.body;

    const phonePattern = /^\d{3}-\d{4}-\d{4}$/;
    if (!phonePattern.test(phoneNumber)) {
        return res.status(400).send('전화번호 형식이 잘못되었습니다. 형식: 010-xxxx-xxxx');
    }

    const sql = 'SELECT userId FROM User WHERE phoneNumber = ? AND password = ?';
    db.query(sql, [phoneNumber, password], (err, result) => {
    if (err) {
        return res.status(500).send('로그인 중 에러.');
    }

    if (result.length > 0) {
        res.json({ message: '로그인 성공!', userId: result[0].userId });
    } else {
        res.status(400).send('로그인 실패: 전화번호 또는 비밀번호가 일치하지 않습니다.');
    }
    });
});

// function loginUser(phoneNumber, password) {
//     return new Promise((resolve, reject) => {
//         const sql = 'SELECT userId FROM User WHERE phoneNumber = ? AND password = ?';
        
//         db.query(sql, [phoneNumber, password], (err, results) => {
//             if (err) {
//                 reject(err);
//             } else {
//                 if (results.length > 0) {
//                     resolve(results[0].userId); // 로그인 성공 시 userId 반환
//                 } else {
//                     resolve(null); // 로그인 실패 시 null 반환
//                 }
//             }
//         });
//     });
// }

// router.post('/loginUser', async (req, res) => {
//     const { phoneNumber, password } = req.body;  // 클라이언트에서 보내온 전화번호와 비밀번호

//     if (!phoneNumber || !password) {
//         return res.status(400).send('전화번호와 비밀번호를 입력하세요.');
//     }

//     try {
//         const userId = await loginUser(phoneNumber, password);

//         if (userId) {
//             // 로그인 성공 시 세션에 userId 저장
//             req.session.userId = userId;
//             return res.json({ userId: userId });  // 클라이언트에 로그인 성공 응답 보내기
//         } else {
//             return res.status(401).send('로그인 실패: 잘못된 전화번호 또는 비밀번호');
//         }
//     } catch (error) {
//         console.error(error);  // 서버 오류 시 로그 출력
//         res.status(500).send('서버 오류');
//     }
// });


// 전화번호 조회 함수
function getPhoneNumberByUserId(userId) {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT phoneNumber FROM User WHERE userId = ?';
        
        db.query(sql, [userId], (err, results) => {
            if (err) {
                reject(err);
            } else {
                if (results.length > 0) {
                    resolve(results[0].phoneNumber); // 전화번호 반환
                } else {
                    resolve(null); // 유저가 없으면 null 반환
                }
            }
        });
    });
}

// 전화번호 조회 API
router.get('/getPhoneNumber', async (req, res) => {
    const userId = req.query.userId;  // 쿼리 파라미터에서 userId 가져오기

    if (!userId) {
        return res.status(401).json({ message: '로그인 상태가 아닙니다.' });  // userId가 없으면 로그인 상태 아님
    }

    try {
        const phoneNumber = await getPhoneNumberByUserId(userId);
        
        if (phoneNumber) {
            return res.json({ phoneNumber });  // 전화번호 반환
        } else {
            return res.status(404).json({ message: '해당 유저의 전화번호를 찾을 수 없습니다.' });
        }
    } catch (error) {
        console.error(error);  // 서버 오류 시 콘솔에 오류 로그 추가
        return res.status(500).json({ message: '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
    }
});



module.exports = router;