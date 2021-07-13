const express = require('express')
const app = express()
const sqlite3 = require('sqlite3')
const dbPath = "app/db/database.sqlite3"
const path = require('path')
const bodyParser = require('body-parser')
const moment = require('moment')
moment.locale("ja")

const schePath = "/api/v1/schedules"
const disPath = "/api/v1/disable"
const memPath = "/api/v1/members"

//リクエストのボディをパースする設定
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

//publicディレクトリを静的ファイル群のルートディレクトリとして設定
app.use(express.static(path.join(__dirname,'public')))


const run = async (sql , db) =>{
    return new Promise((resolve,reject) => {
        db.run(sql,(err) =>{
            if(err){
                return reject(err);
            }else{
                return resolve()
            }
        })
    })
}


//--------------------------------------------------ここからschedulesテーブルの処理------------------------------------------//



// Get all schedules
app.get(schePath , (req, res)=>{
    // Connect database
    const db = new sqlite3.Database(dbPath)
    db.all('SELECT * FROM schedules',(err , rows)=>{
        res.json(rows)
    })
    db.close()
})

// GET a schedule
app.get(schePath + '/:id', (req, res)=>{
    // Connect database
    const id = req.params.id
    const query = req.query.q
    const db = new sqlite3.Database(dbPath)
    db.get(`SELECT * FROM schedules WHERE id = ${id} AND password = ${query}`,(err , row)=>{
        if(!row){
            res.status(404).send({error : "Not Found!"})
        }else{
            res.status(200).json(row)
        }
    })
    db.close()
})


//create a new schedule
app.post(schePath , async (req,res)=>{
    if(!req.body.member_number || !req.body.term || !req.body.password ||!req.body.start_time){
        res.status(400).send({error : "必須項目が入力されていません"})
    }else{
        // Connect database
        const db = new sqlite3.Database(dbPath)
        const member_number = req.body.member_number
        const term = req.body.term
        const password = req.body.password
        const start_time = req.body.start_time
        let id = 0;
        db.get(`SELECT max(id) FROM schedules`,(err , row)=>{
            if(!row){
                res.status(404).send({error : "Not Found!"})
            }else{
                id = row
            }
        })

        try{
            await run(`INSERT INTO schedules (member_number , term , password , start_time) VALUES ("${member_number}","${term}","${password}","${start_time}")`,db)
            res.status(201).json(id)
        }catch(e){
            res.status(500).send({error : e})
        }
        db.close()
    }
})

//update a schedule
app.put(schePath + '/:id' , async (req,res)=>{
    if(!req.body.member_number || !req.body.term || !req.body.password ||!req.body.start_time){
        res.status(400).send({error : "必須項目が入力されていません"})
    }else{
        // Connect database
        const db = new sqlite3.Database(dbPath)
        const id = req.params.id

        //現在のユーザー情報を取得する
        db.get(`SELECT * FROM schedules WHERE id = ${id}`,async (err , row)=>{
            if (!row){
                res.status(204).send({erroe : "指定されたユーザーが見つかりません"})
            }else{
                const member_number = req.body.member_number
                const term = req.body.term
                const password = req.body.password
                const start_time = req.body.start_time

                try{
                    await run(`UPDATE schedules SET member_number = "${member_number}" , term = "${term}" , password = "${password}" , start_time = "${start_time}" WHERE id = "${id}"` , db)
                    res.status(201).send({message : "ユーザーを更新しました"})
                }catch(e){
                    res.status(500).send({error : e})
                }
            }
            
        })
        db.close()
    }
})

//delete a user
app.delete(schePath + '/:id' , async (req,res)=>{
    // Connect database
    const db = new sqlite3.Database(dbPath)
    const id = req.params.id

    await run(`DELETE FROM schedules WHERE id = "${id}"` , db)
    res.send({message:"ユーザー情報を削除しました"})
    db.close()
})




//--------------------------------------------------ここからdisableテーブルの処理------------------------------------------//



// Get all disable date
app.get(disPath , (req, res)=>{
    // Connect database
    const db = new sqlite3.Database(dbPath)
    const sche_id = req.query.scheId
    db.all(`SELECT * FROM disable WHERE schedule_id = ${sche_id}`,(err , rows)=>{
        if(!rows){
            res.status(404).send({error : "Not Found!"})
        }else{
            res.status(200).json(rows)
        }
    })
    db.close()
})

// GET member's all disable date
app.get(disPath + '/:id', (req, res)=>{
    // Connect database
    const id = req.params.id
    const mid = req.query.mid
    const db = new sqlite3.Database(dbPath)
    db.all(`SELECT * FROM disable WHERE schedule_id = ${id} AND member_id = ${mid}` ,(err , rows)=>{
        if(!rows){
            res.status(404).send({error : "Not Found!"})
        }else{
            res.status(200).json(rows)
        }
    })
    db.close()
})


//create a new disable
app.post(disPath , async (req,res)=>{
    if(!req.query.scheId || !req.body.member_number || !req.body.term){
        res.status(400).send({error : "必須項目が入力されていません"})
    }else{
        // Connect database
        const db = new sqlite3.Database(dbPath)
        const schedule_id = req.query.scheId + ""
        const member_number = req.body.member_number
        const term = req.body.term
        const disable_time = "NULL"

        const days = moment(term[1], 'YYYY-MM-DD').diff(moment(term[0], 'YYYY-MM-DD'), 'days')
        const first_day = term[0]

        let VALS = ""
        for (let j = 1; j <= member_number; j++){
            let member_id = j + ""
            for (let i = 0; i <= days; i++){
                VALS += "( \'" + schedule_id + "\' , \'" + member_id + "\' , \'" + moment(first_day,"YYYY-MM-DD").add(i,"days").format('YYYY-MM-DD') + "\' , \'NULL\')"
                if (i != days || j != member_number){
                    VALS += ","
                } 
            }
        }
        

        //insertするデータ ( ...  , ... , ...),( ...  , ... , ...)
        //同時にデータをInsertするためにまとまったものを生成

        //let days = moment('2018-12-25', 'YYYY-MM-DD').diff(moment('2017-12-25', 'YYYY-MM-DD'), 'days')
        //let t = moment(test,"YYYY-MM-DD").add(1,"days").format('YYYY-MM-DD') + ""
        

        try{
            await run(`INSERT INTO disable (schedule_id , member_id , disable_date , disable_time) VALUES ${VALS}`,db)
            res.status(201).send({message : "新規作成しました"})
            //res.send(VALS)
        }catch(e){
            res.status(500).send({error : e})
        }
        db.close()
    }
})

//update a disable date
app.put(disPath + '/:id' , async (req,res)=>{
    // Connect database
    const db = new sqlite3.Database(dbPath)
    const schedule_id = req.params.id
    const mid = req.query.mid

    //現在のユーザー情報を取得する
    db.all(`SELECT * FROM disable WHERE schedule_id = ${schedule_id} AND member_id = ${mid}`,async (err , rows)=>{
        if (!rows){
            res.status(204).send({erroe : "指定されたユーザーが見つかりません"})
        }else{
            const disable_date = req.body.disable_date
            const disable_time = (req.body.disable_time).slice(1)

            /*
            UPDATE disable SET 
                "birth" =
                    case "disable_date"
                        WHEN "hogehoge1" THEN "fugafuga"
                        WHEN "hogehoge2" THEN "fugafuga"
                        WHEN "hogehoge3" THEN "fugafuga"
                    END
                WHERE "disable_date" IN ("hogehoge1","hogehoge2","hogehoge3")
            */
            let IN = "(\'"
            let VALS = ""
            const l = disable_date.length
            for(let i = 0; i < l; i++){ 
                let val = "WHEN " + "disable_date == \'" + disable_date[i] + "\' THEN "
                let times_val = ""
                disable_time[i].forEach(el => {
                    if (times_val != ""){
                        times_val += "," + el
                    }else{
                        times_val += el
                    }
                });
                val += "\'" + times_val + "\' "
                VALS += val
                if(i < l-1){
                    IN += disable_date[i] +"\' , \'"
                }else{
                    IN += disable_date[i] + "\' )"
                }
            }

            try{
                await run(`UPDATE disable SET 
                            disable_time =
                                CASE
                                    ${VALS}
                                END
                            WHERE schedule_id = ${schedule_id} AND member_id = ${mid} AND disable_date IN ${IN}`
                ,db)
                res.status(201).send({message : "ユーザーを更新しました"})
                //res.send(VALS)
            }catch(e){
                res.status(500).send({error : e})
            }
        }
        
    })
    db.close()
})

//delete a disable date
app.delete(disPath + '/:id' , async (req,res)=>{
    // Connect database
    const db = new sqlite3.Database(dbPath)
    const id = req.params.id
    const mid = req.query.mid

    await run(`DELETE FROM disable WHERE schedule_id = "${id}" AND member_id = "${mid}"` , db)
    res.send({message:"ユーザー情報を削除しました"})
    db.close()
})


//--------------------------------------------------ここからmembersテーブルの処理--------------------------------------------//


// Get all members
app.get(memPath , (req, res)=>{
    // Connect database
    const db = new sqlite3.Database(dbPath)
    const sche_id = req.query.scheId
    db.all(`SELECT * FROM members WHERE schedule_id = ${sche_id}`,(err , rows)=>{
        if(!rows){
            res.status(404).send({error : "Not Found!"})
        }else{
            res.status(200).json(rows)
        }
    })
    db.close()
})

// GET a member
app.get(memPath + '/:id', (req, res)=>{
    // Connect database
    const schedule_id = req.params.id
    const member_id = req.query.mid
    const db = new sqlite3.Database(dbPath)
    db.get(`SELECT * FROM members WHERE schedule_id = ${schedule_id} AND member_id = ${member_id} `,(err , row)=>{
        if(!row){
            res.status(404).send({error : "Not Found!"})
        }else{
            res.status(200).json(row)
        }
    })
    db.close()
})

//create a new member
app.post(memPath , async (req,res)=>{
    if(!req.body.member_number || !req.body.member_info){
        res.status(400).send({error : "必須項目が入力されていません"})
    }else{
        // Connect database
        const db = new sqlite3.Database(dbPath)
        const schedule_id = req.query.scheId
        const member_number = req.body.member_number
        const member_info = req.body.member_info
        let VALS = ""
        for(let i = 0; i < member_number; i++){
            VALS += `(${schedule_id} , ${i + 1} ,'${member_info[i]}')`
            if(i != member_number - 1){
                VALS += ","
            }
        }

        try{
            await run(`INSERT INTO members (schedule_id , member_id , name) VALUES ${VALS}`,db)
            res.status(201).send({message : "新規ユーザーを作成しました"})
        }catch(e){
            res.status(500).send({error : e})
        }
        db.close()
    }
})

//update a user
app.put(memPath + '/:id' , async (req,res)=>{
    if(!req.body.member_name){
        res.status(400).send({error : "必須項目が入力されていません"})
    }else{
        // Connect database
        const db = new sqlite3.Database(dbPath)
        const member_id = req.query.mid
        const schedule_id = req.params.id
        //現在のユーザー情報を取得する
        db.get(`SELECT * FROM members WHERE schedule_id = ${schedule_id} AND member_id = ${member_id}`,async (err , row)=>{
            if (!row){
                res.status(204).send({erroe : "指定されたユーザーが見つかりません"})
            }else{
                const db = new sqlite3.Database(dbPath)
                const member_name = req.body.member_name
                const member_place = req.body.member_place

                try{
                    await run(`UPDATE members SET name = "${member_name}" , place = "${member_place}" WHERE member_id = "${member_id}" AND schedule_id = "${schedule_id}" ` , db)
                    res.status(201).send({message : "ユーザーを更新しました"})
                }catch(e){
                    res.status(500).send({error : e})
                }
            }
            
        })
        db.close()
    }
})

//update a user
app.delete(memPath + '/:id' , async (req,res)=>{
    // Connect database
    const db = new sqlite3.Database(dbPath)
    const schedule_id = req.params.id
    const member_id = req.query.mid

    await run(`DELETE FROM members WHERE schedule_id = "${schedule_id}" AND member_id = ${member_id}` , db)
    res.send({message:"ユーザー情報を削除しました"})
    db.close()
})


const port = process.env.PORT || 3000;
app.listen(port)
console.log("Listen on port: " + port)