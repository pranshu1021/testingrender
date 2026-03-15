require("dotenv").config();
const express = require("express");
const app = express();
const mysql = require("mysql2");
const path= require("path");
const port = process.env.MYSQLPORT;
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

const db = mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
});

app.get("/", (req, res) => {
    db.query("SELECT * FROM users", (err, result) => {
        if (err) {
            console.log(err);
            return res.send("Database error");
        }
        res.render("home.ejs", {result,page:"home"});
    });
});

app.get("/sign-up",(req,res)=>{
    res.render("signup",{page:"signup"})
})

// SIGN UP SYSTEM DONE 
app.post("/sign-up",async (req,res)=>{
    let{name,username,email,dob,password,bio,profileurl,country}=req.body;
    let hashedPassword = await bcrypt.hash(password,10);
    console.log(hashedPassword)
    let birth = new Date(dob);
    let today= new Date();
    let age = today.getFullYear()-birth.getFullYear();
    let id = uuid4();
    if(age<13){
        return res.render("signup",{error:"You have to be 13+ to make an account on AnswerNest, Come back when you're 13 or 13+.",page:"home"})
    }
    let sql= "INSERT INTO users(id,name,username,email,dob,password,bio,profileurl,country) VALUES (?,?,?,?,?,?,?,?,?)"; 
        db.query(sql,[id,name,username,email,dob,hashedPassword,bio,profileurl,country],(err,result)=>{
            if(err) throw err;
            res.send("You're Registered and added to our Sweet Database.")
        })})

app.get("/post-question",(req,res)=>{
    app.render("dashboard");
})

//LOGIN SYSTEM
app.get("/login",(req,res)=>{
    res.render("login",{page:"signup"})
})
app.post("/login",(req,res)=>{
    let{username,password} = req.body;
    let sql = `SELECT * FROM users WHERE username=? OR email=?`;
    db.query(sql,[username,username], async(err,result)=>{
        if(result.length==0){
            return res.send("User Not Found");
        }
        let user = result[0]
        let match = await bcrypt.compare(password,user.password);
        if(!match){
            return res.render("login",{error:"You entered wrong username/ email or password.",page:"home"});
        }
        req.session.user = user;
        console.log(req.session.user)
        res.redirect("/")
    })
})
app.get("/ask-a-question",(req,res)=>{
    res.render("askquestion")
})
app.get("/guidelines", (req,res)=>{
    res.render("guidelines",{
        page: "home"
    });
});
app.get("/logout",(req,res)=>{
    req.session.destroy();
    res.redirect("/login");
})

app.listen(port,()=>{
    console.log(`listening to port ${port}`);
});