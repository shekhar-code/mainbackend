import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"

const registerUser = asyncHandler( async (req , res) => {
  // res.status(200).json({
  //   message: "OK"
  // })

  //get user details from frontend
  //validation - not empty
  //check if user already exists : username , email
  //check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return res

  const {fullName , email , username , password} =  req.body
  console.log("email" , email);

  // if(fullName === ""){
  //   throw new ApiError(400 , "fullname is required")
  // }

  if(
    [fullName , email , username , password].some( (field) =>
    field?.trim() === "")
  ){
    throw new ApiError(400, "all field are required")
  }

  const existedUser = User.findOne({
    $or: [{username} , {email} ]
  })

  if(existedUser) {
    throw new ApiError(409 , "user with email name already exists")

  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;
  // console.log("detail of multer send files" , req.files);

  if (!avatarLocalPath) {
    throw new ApiError(400 , "avatar file is required")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if (!avatar) {
    throw new ApiError(400 , "avatar not uploaded")
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
  })

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )

  if (!createdUser) {
    throw new ApiError(500 , "something went wrong while registering user")

  }

  return res.status(201).json(
    new ApiResponse(200 , createdUser , "user registered successfully")
  )

})

export {registerUser};