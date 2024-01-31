import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

//just next line me req ke bad 'res' ki jgh '_' tb lga dete h jb 'res' kam nhi aa rha ho

export const verifyJWT = asyncHandler(async(req, _ ,next) => {
  try {
    const token = req.cookies?.accessToken || req.header
    ("Authorization")?.replace("Bearer", "")
  
    if(!token) {
      throw new ApiError(401 , "unouthorized request")
    }
  
    const decodedToken = Jwt.verify(token , process.env.ACCESS_TOKEN_SECRET)
  
    const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
  
    if(!user){
      //todo: discuss about frontend
      throw new ApiError(401 , "invalid access token")
    }
  
    req.user = user;
    next()

  } catch (error) {
    throw new ApiError(401 , error?.message || "invalid access token")
  }

})