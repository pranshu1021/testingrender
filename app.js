require("dotenv").config();
const express = require("express");
const app = express();
const mysql = require("mysql2");
const path= require("path");
const port = process.env.PORT;
const bcrypt = require("bcrypt");
const session = require("express-session");
const {v4:uuid4}= require("uuid");



app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,"public")));

app.use(session({
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized:false
}))
app.use((req,res,next)=>{
    res.locals.user = req.session.user;
    next();
});

function requireLogin(req,res,next){
    if(!req.session.user){
        return res.redirect("/login");
    }
    next();
}
const db = mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
}).promise();

app.get("/", async (req, res) => {
    try{

        const [questions] = await db.query(
            "SELECT id,asked_at, title FROM questions ORDER BY id DESC LIMIT 5"
        );

        res.render("home.ejs", {
            page:"home",
            questions
        });

    }catch(err){
        console.log(err);
        res.send("Database error");
    }
});

app.get("/sign-up",(req,res)=>{
    res.render("signup",{page:"signup"})
})

// SIGN UP SYSTEM DONE 
app.post("/sign-up",async (req,res)=>{
    let{name,username,email,dob,password,bio,profileurl,country}=req.body;
    let hashedPassword = await bcrypt.hash(password,10);
    let birth = new Date(dob);
    let today= new Date();
    let age = today.getFullYear()-birth.getFullYear();
    let id = uuid4();
    if(age<13){
        return res.render("signup",{error:"You have to be 13+ to make an account on AnswerNest, Come back when you're 13 or 13+.",page:"home"})
    }
    let sql= "INSERT INTO users(id,name,username,email,dob,password,bio,profileurl,country) VALUES (?,?,?,?,?,?,?,?,?)"; 
        await db.query(sql,[id,name,username,email,dob,hashedPassword,bio,profileurl,country]);

        const [questions] = await db.query(`
        SELECT q.id, q.title, q.description,
        GROUP_CONCAT(t.name) as tags
        FROM questions q
        LEFT JOIN question_tags qt ON q.id = qt.question_id
        LEFT JOIN tags t ON qt.tag_id = t.id
        GROUP BY q.id
        ORDER BY q.id DESC
    `);
res.render("home",{page:"home", questions})
})

app.get("/post-question",(req,res)=>{
    res.render("askquestion",{page:"home" });
})

//LOGIN SYSTEM
app.get("/login",(req,res)=>{
    res.render("login",{page:"signup"})
})
app.post("/login", async (req,res)=>{
    let {username,password} = req.body;

    let sql = `SELECT * FROM users WHERE username=? OR email=?`;
    const [result] = await db.query(sql,[username,username]);

    if(result.length==0){
        return res.render("login",{error:"No such User exists",page:"home"});
    }

    let user = result[0];
    let match = await bcrypt.compare(password,user.password);

    if(!match){
        return res.render("login",{error:"Wrong username/email or password",page:"home"});
    }

    req.session.user = user;
    res.redirect("/");
});
app.get("/ask-a-question",requireLogin,(req,res)=>{
    res.render("askquestion",{page:"home"});
});

app.post("/questions",requireLogin,async (req,res)=>{
    let {title,description,tags}=req.body;
    let user_id=  req.session.user.id;
    let tagsarr=tags.split(",");
    // let placeholder = "?"
//     let placeholders = tagsarr.map(()=> "(?)").join(",");
    console.log(req.body);
    let question_id=uuid4();


    await db.query(
        "INSERT INTO questions (id,user_id,title,description) VALUES (?,?,?,?)",
        [question_id,user_id,title,description]
    );

    for(let tag of tagsarr){
        tag = tag.trim().toLowerCase();

        const [existing] = await db.query(
            "SELECT id FROM tags WHERE name = ?",
            [tag]
        );

        let tagId;

        if(existing.length === 0){
            const [newTag] = await db.query(
                "INSERT INTO tags (name) VALUES (?)",
                [tag]
            );
            tagId = newTag.insertId;
        } else {
            tagId = existing[0].id;
        }

        await db.query(
            "INSERT INTO question_tags (question_id, tag_id) VALUES (?, ?)",
            [question_id, tagId]
        );
        
    }

    res.redirect("/dashboard",{page:"home"});
})

app.get("/guidelines", (req,res)=>{
    res.render("guidelines",{
        page: "home"
    });
});

app.get("/logout",(req,res)=>{
    req.session.destroy();
    res.redirect("/");
})

app.get("/dashboard/edit/:id",async (req,res)=>{
    const {id} = req.params;
    const [post] = await db.query("SELECT * FROM questions WHERE id=?",[id]);
    if(post.length === 0){
        return res.redirect("/dashboard");
    }
    console.log("hello")
    console.log("hello")
    res.render("edit",{post:post[0],page:"home"})
})
// user_id = 5, uuid  Q 127
app.post("/dashboard/edit/:id", async(req,res)=>{
    const {id} =req.params;
    const {title,description} = req.body;
    const [post] = await db.query("SELECT * FROM questions WHERE id=?",[id]);
    if(post[0].user_id !== req.session.user.id){
        return res.redirect("home?error=unauthorized")
    }
    await db.query("UPDATE questions SET title=?,description=? WHERE id=?",[title,description,id]);
    res.redirect("dashboard")
})

app.get("/explore",async(req,res)=>{
    const [questions]=await db.query("SELECT q.*, u.username,u.profileurl FROM questions q JOIN users u ON q.user_id = u.id ORDER BY q.asked_at DESC");
    res.render("explore", {questions,page:"home"})
})
app.get("/question/:id",async (req,res)=>{
    const questionId = req.params.id;
    const [question] = await db.query("SELECT * FROM questions WHERE id=?",[questionId]);
    const[answers] = await db.query(`SELECT a.*, u.username, u.profileUrl 
                                        FROM answers a
                                        JOIN users u ON a.user_id = u.id
                                        WHERE a.id = ?
                                        ORDER BY a.created_at DESC`,[questionId])
    res.render("question",{question: question[0],answers,page:"home"})
})

app.post("/answer", async(req,res)=>{
    const {content,questionId}= req.body;
    const userId = req.session.user.id;

    await db.query("INSERT INTO answers(content, user_id,id) VALUES (?,?,?)",[content,userId,questionId]);
    res.redirect(`/question/${questionId}`);

})

// app.post("/dashboard/delete/:id",async (req,res)=>{
//     const questionId = req.params.id;

//     await db.query("DELETE FROM questions WHERE id = ?",[questionId]);
//     res.redirect("/dashboard"); 
// })

app.get("/dashboard", requireLogin, async (req,res)=>{

    let userId = req.session.user.id;

    const [questions] = await db.query(`
        SELECT q.id, q.title, q.description,
        GROUP_CONCAT(t.name) as tags
        FROM questions q
        LEFT JOIN question_tags qt ON q.id = qt.question_id
        LEFT JOIN tags t ON qt.tag_id = t.id
        WHERE q.user_id = ?
        GROUP BY q.id
        ORDER BY q.id DESC
    `,[userId]);

    res.render("dashboard",{
        questions,
        page:"home"
    });
});


app.listen(port,()=>{
    console.log(`listening to port ${port}`);
});