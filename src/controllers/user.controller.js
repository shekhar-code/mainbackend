import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async(userId) => {
  try {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({validateBeforeSave: false})

    return {accessToken , refreshToken}

  } catch (error) {
    throw new ApiError(500 , "something went wrong while generating refresh and access tokens")
  }
}

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
  // console.log("fullName" , fullName);

  // if(fullName === ""){
  //   throw new ApiError(400 , "fullname is required")
  // }

  if(
    [fullName , email , username , password].some( (field) =>
    field?.trim() === "")
  ){
    throw new ApiError(400, "all field are required")
  }

  const existedUser = await User.findOne({
    $or: [{username} , {email} ]
  })

  if(existedUser) {
    throw new ApiError(409 , "user with email name already exists")

  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // here the issue in below line is we are not checking whether coverImage is present or not so we have to use classic if else method
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  // console.log("detail of multer send files" , req.files);

  let coverImageLocalPath;

  if (req.files && Array.isArray(req.files.coverImage) &&
  req.files.coverImage.length>0 ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

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

const loginUser = asyncHandler( async (req , res) => {

  //take login details from frontend req body
  //check all the required fileds is present or not
  //check email is in right format or not
  //check whether the user exists in database or not

  // req body -> data
  //username or email
  //find the user
  //password check
  //access and refresh token
  //send cookie

  const {email , username , password} = req.body

  if(!(username || email)){
    throw new ApiError(400, "username or email is required")
  }

  const user = await User.findOne({
    $or: [{username} , {email}]
  })

  if (!user) {
    throw new ApiError(404 , "user does not exist")
  }

  const isPasswordValid = await user.isPasswordCorrect(password)

  if(!isPasswordValid){
    throw new ApiError(401 , "invalid user credentials")
  }

  const {accessToken , refreshToken} = await generateAccessAndRefreshTokens(user._id)

  const loggedInUser = await User.findById(user._id).
  select("-password -refreshToken")

  const options = {
    httpOnly: true,
    secure: true
  }

  return res.status(200)
  .cookie("accessToken" , accessToken , options)
  .cookie("refreshToken", refreshToken , options)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedInUser, accessToken, refreshToken
      },
      "user logged in successfully"
    )
  )
  
})

const logoutUser = asyncHandler( async(req , res) => {
  const user = await req.user._id

  User.findByIdAndUpdate(
    await req.user._id,
    {
      $unset: {
        refreshToken: 1 //this removes the field from document
      }
    },
    {
      new: true
    }
  )

  const options = {
    httpOnly: true,
    secure: true
  }

  return res.status(200)
  .clearCookie("accessToken" , options)
  .clearCookie("refreshToken" , options)
  .json(new ApiResponse(200 , {} , "user loggedout successfully"))

})

const refreshAccessToken = asyncHandler( async(req , res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if (!incomingRefreshToken) {
    throw new ApiError(401 , "unauthorized request")
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    )
  
    const user = await User.findById(decodedToken?._id)
  
    if (!user) {
      throw new ApiError(401 , "invalid refresh token")
    }
  
    if(incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "refresh token is expired or used")
    }
  
    const options = {
      httpOnly: true,
      secure: true
    }
  
    const {accessToken , newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
  
    return res.status(200)
    .cookie("accessToken" , accessToken , options)
    .cookie("refreshToken" , newRefreshToken , options)
    .json(
      new ApiResponse(
        200,
        {
          accessToken ,
          refreshToken: newRefreshToken
        },
        "access token refreshed"
      )
    )
  
  } catch (error) {
    throw new ApiError(401 , error?.message || "invalid refresh token")
  }
})

const changeCurrentPassword = asyncHandler( async(req , res) => {
  const {oldPassword , newPassword} = req.body

  const user = await User.findById(req.user?._id)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

  if(!isPasswordCorrect){
    throw new ApiError(400 , "invalid old password")
  }

  user.password = newPassword
  await user.save({validateBeforeSave: false})

  return res.status(200)
  .json(
    new ApiResponse(
      200,
      {},
      "password changed successfully"
    )
  )
})

const getCurrentUser = asyncHandler( async(req, res) => {

  return res.status(200)
  .json(200,
    req.user,
    "current user fetched successfully")
})

const updateAccountDetails = asyncHandler( async(req, res) => {

  const {fullName  ,email} = req.body

  if(!fullName && !email) {
    throw new ApiError(400 , "all fields are required")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName: fullName,
        email: email
      }
    },
    {new: true} //this line returns all the updated values
  ).select("-password")

  return res.status(200)
  .json(
    new ApiResponse(200,
      user,
      "account details updated successfully")
  )
})

const updateUserAvatar = asyncHandler( async(req, res) => {

  const avatarLocalPath = req.file?.path

  if(!avatarLocalPath){
    throw new ApiError(400 , "avatar file is missing")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)

  //todo: delete or remove old avatar file

  if(!avatar.url){
    throw new ApiError(400 , "error while uploading on avatar")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url
      }
    },
    {
      new: true
    }
  ).select("-password")



  return res.status(200)
  .json(new ApiResponse(
    200,
    user,
    "avatar updated successfully"
  ))
})

const updateUserCoverImage = asyncHandler( async(req, res) => {

  const coverImageLocalPath = req.file?.path

  if(!coverImageLocalPath){
    throw new ApiError(400 , "cover image file is missing")
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!coverImage.url){
    throw new ApiError(400 , "error while uploading on coverImage")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url
      }
    },
    {
      new: true
    }
  ).select("-password")



  return res.status(200)
  .json(new ApiResponse(
    200,
    user,
    "coverimage updated successfully"
  ))
})

const getUserChannelProfile = asyncHandler( async (req,res) => {
  const {username} = req.params

  if(!username?.trim()) {
    throw new ApiError(400 , "username is missing")
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase()
      }
    },
    {
      $lookup: {
        from: "Subscription",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"
      }
    },
    {
      $lookup: {
        from: "Subscription",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"
      }
    },
    {
      $addFields: {
        subscribersCount: {
          // $size: "$subscribers"
          $size: { "$ifNull": [ "$subscribers", [] ] }
        },
        channelSubscribedToCount: {
          // $size: "subscribedTo"
          $size: { "$ifNull": [ "$subscribedTo", [] ] }
        },
        isSubscribed: {
          $cond: {
            if: {$in: [req.user?._id , "$subscribers.subscriber"]},
            then: true,
            else: false

          }
        }

      }
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1
      }
    }
  ])

  if(!channel?.length) {
    throw new ApiError(404, "channel does not exists")
  }

  return res.status(200)
  .json(
    new ApiResponse(
      200,
      channel[0],
      "user channel fetched successfully"
    )
  )
})

const getWatchHistory = asyncHandler(async (req,res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1
                  }
                }
              ]
            }
          },
          {
            $addFields:{
              owner:{
                $first: "$owner"
              }
            }
          }
        ]
      }
    }
  ])

  return res.status(200)
  .json(
    new ApiResponse(
      200,
      user[0].watchHistory,
      "watch history fetched successfully"
    )
  )
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory
};