import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/User.model.js"
import {uploadOnCloudnary} from "../utils/cloudnary.js"
import {ApiResponse} from "../utils/APIResponse.js"
import jwt from "jsonwebtoken"

const generateAcessAndRefereshTokens = async(userId) => {
   try {
      const user = await User.findById(userId)
      const accessToken =  user.generateAcessToken()
      const refereshToken = user.generateRefreshToken()

      user.refereshToken = refereshToken
      user.save({validateBeforeSave: false})

   } catch (error) {
      throw new ApiError(500, "something want wrong while genrating a access and referesh token")
   }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user datails from frontend 
    // vailidation - not empty
    // check if user are already exists: username, email
    //check for image check for avtar 
    // upload them to cloudinary, avtar 
    // create user object- create entry in db
    //remove pasword and refresh token filed from response
    //check user are create
    //return res

  const {fullname, email, username, password} = req.body   

 if (
    [fullname, email, username, password].some((field) => field?.trim()==="")
 ) {
    throw new ApiError(400, "All field are required")
 }

 const existsUser = await User.findOne({
    $or: [{ username }, { email }]
 })

 if (existsUser) {
     throw new ApiError(409, "user with email or username already exists")
 }
const avtarLocalPath = req.files?.avtar[0]?.path;
// const coverImageLocalPath = req.files?.coverImage[0]?.path;
 
let coverImageLocalPath;
if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
   coverImageLocalPath = req.files.coverImage[0].path
}

if (!avtarLocalPath) {
    throw new ApiError(400, "Avtar fill is required ");
}

const avtar = await uploadOnCloudnary(avtarLocalPath)
const coverImage = await uploadOnCloudnary(coverImageLocalPath)
    
 if (!avtar) {
    throw new ApiError(400, "Avtar fill is required ");
 }   

const user = await User.create({
    avtar:avtar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    fullname,
    username: username.toLowerCase()
 })

 const createUser = await User.findById(user._id).select(
   "-password -refreshToken"
 )
 if (!createUser) {
   throw new ApiError(500, "Something want wrong while registering a user")
 }

 return res.status(201).json(
   new ApiResponse(200, createUser, "User registered successfully")
 )

})

const loginUser = asyncHandler(async (req, res) => {
   // req -> deta
   // userName and email 
   // find the user 
   // password check
   // access and ref token 
   // send cookie

   const {email, username, password} = req.body
   console.log(email);

   if (!email && !username) {
      throw new ApiError(400, "Email and username is required")
   }

   const user = await User.findOne({
      $or: [{username}, {email}]
   })

   if (!user) {
      throw new ApiError (404, "User does not exist")
   }

   const isPasswordValid = await user.isPasswordCorrect(password)
   
   if (!isPasswordValid) {
      throw new ApiError (401, "Invalid user password")
   }

  const {accessToken, refereshToken} = await generateAcessAndRefereshTokens(user._id)

const loggedInUser = await User.findById(user._id).select("-password -refereshToken")

const options = {
   httpOnly:true,
   secure: true, 
}

return res
.status(200)
.cookie("accessToken", accessToken, options)
.cookie("refereshToken", refereshToken, options)
.json(
   new ApiResponse(
      200, 
      {
         user: loggedInUser, accessToken, refereshToken
      },
      "User logged in successfully"
   )
)
})

const logoutUser = asyncHandler(async (req, res) => {
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $set: {
            refreshToken: undefined
         }
      },
      {
         new: true
      }
   )

   const options = {
      httpOnly:true,
      secure: true, 
   }

   return res.status(200)
   .clearCookie("accessToken", options)
   .clearCookie("refreshToken", options)
   .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if (!incomingRefreshToken) {
     throw new ApiError (401, "unauthorized request")
}

try {
   const decodedToken = jwt.verify(
      incomingRefreshToken,
       process.env.REFRESH_TOKEN_SECRET
   )
   
   const user = await User.findById(decodedToken?._id)
   if (!user) {
      throw new ApiError (401, "Invalid refresh token")
   }
   
   if (incomingRefreshToken !== user?.refereshToken) {
      throw new ApiError (401, "Refresh token is expired oor Used")
   }
   
       const options = {
         httpOnly: true,
         secure: true
       }
   
      const {accessToken, newRefereshToken} = await generateAcessAndRefereshTokens(user._id)
   
      return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefereshToken, options)
      .json(
         new ApiResponse(
            200,
            {accessToken, refereshToken: newRefereshToken},
            "Access token refreshed"
         )
         
      )
   } catch (error) {
      throw new ApiError(401, error?.message || "Invalid refresh token")
   }
})
export {
   registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
   }