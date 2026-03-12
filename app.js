require("dotenv").config();
const express = require("express");
const app = express();
const mysql = require("mysql2");
const path= require("path");
const port = process.env.PORT || 3000;

app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,"public")));

const db = mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
});

app.get("/",(req,res)=>{
        db.query("SELECT * FROM users",(err,result)=>{
        res.render("home.ejs",{result});
    })
})

app.post("/",(req,res)=>{
    let {id,name,age} = req.body;
    db.query(
        "INSERT INTO users (id, username, age) VALUES (?, ?, ?)",
        [id, name, age],
        (err,result)=>{
    console.log("New user added");
    res.redirect("/");
});
    console.log(id,name,age)
})
app.listen(port,()=>{
    console.log(`listening to port ${port}`);
});
