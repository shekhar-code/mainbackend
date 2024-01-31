// import mongoose from 'mongoose';
// import { DB_NAME } from "./constants";
// require('dotenv').config({path: './env'})

import dotenv from "dotenv"
import connectDB from "./db/index.js"
import { app } from "./app.js"

dotenv.config({
  path: './.env'
})

connectDB()
.then(() => {

  app.on("ERROR" , (err) => {
    console.log("ERROR:" , err);
    throw err
  })

  app.listen(process.env.PORT || 8000 , () => {
    console.log(`server is running on port ${process.env.PORT}`);
  })

})
.catch((err) => {
  console.log("mongodb connection failed !!!" , err);
})



/* //first way to connect with mongo
import express from "express";
const app = express();

( async () => {

  try{
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);

    app.on("error" , (error) => {
      console.log("error :" , error);
      throw error
    })

    app.listen(process.env.PORT , () => {
      console.log(`app is listening on port ${process.env.PORT}`);
    })
  } catch(error){
    console.error("ERROR: " , error);
    throw error;
  }
} )()
*/