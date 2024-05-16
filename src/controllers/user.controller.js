import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/User.model.js"
import {uploadOnCloudnary} from "../utils/cloudnary.js"
import {ApiResponse} from "../utils/APIResponse.js"
import jwt from "jsonwebtoken"
import { emit } from "nodemon";

const generateAcessAndRefereshTokens = async(userId) => {
   try {
      const user = await User.findById(userId)
      const accessToken =  user.generateAcessToken()
      const refereshToken = user.generateRefreshToken()

      user.refereshToken = refereshToken
      user.save({validateBeforeSave: false})

      user.accessToken = accessToken
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

const changeCurrentPassword = asyncHandler(async(req, res) => {
   const {oldPassword, newPassword} = req.body

  const user = await User.findById(req.user?._id)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    
  if (!isPasswordCorrect) {
   throw new ApiError(400, "Invalid old password")
  }

  user.password = newPassword
  await user.save({validateBeforeSave: false})

  return res
  .status(200)
  .json(new ApiResponse(200, {}, "Password changed successfully"))
})

   const getCurrentUser = asyncHandler(async(req, res) => {
      return res
      .status(200)
      .json(200, req.user, "current user fetched successfully")
   })

   const updateAccountDetails = asyncHandler(async(req, res) => {
      const {fullName, email} = req.body

      if (!fullName || !email) {
         throw new ApiError(400, "All fields are required")
      }
                
      const user = await User.findByIdAndUpdate(
         req.user._id,
       {
         $set: {
            fullName,
            email 
         }
       },
       {new: true}
      
      ).select("-password")

      return res
      .status(200)
      .json(new ApiResponse(200,user,"Account details updated successsfully"))

      
   })

   const updateUserAvtar = asyncHandler(async(req, res) => {
      const avtarLocalPath =req.file?.path

      if (!avtarLocalPath) {
         throw new ApiError(400, "Avtar fill is missing")
      }

      const avtar = await  uploadOnCloudnary(avtarLocalPath)

      if (!avtar.url) {
         throw new ApiError(400, "Error while be upload on cloudnary")
      }

      const user = await User.findByIdAndUpdate(
         req.user?._id,
         {
            $set: {
               avtar: avtar.url
            }
         },
         {new: true}
      ).select("-password")

      return res
      .status(200)
      .json(
         new ApiResponse(200, user, "Avtar update successfully")
      )
   })

   const updateUserCoverImage = asyncHandler(async(req, res) => {
      const CoverImageLocalPath =req.file?.path

      if (!CoverImageLocalPath) {
         throw new ApiError(400, "coverImage fill is missing")
      }

      const coverImage = await  uploadOnCloudnary(avtarLocalPath)

      if (!coverImage.url) {
         throw new ApiError(400, "Error while be upload on cloudnary")
      }

      const user = await User.findByIdAndUpdate(
         req.user?._id,
         {
            $set: {
               coverImage: coverImage.url
            }
         },
         {new: true}
      ).select("-password")

      return res
      .status(200)
      .json(
         new ApiResponse(200, user, "coverImage update successfully")
      )
   })

   const getUserChannelProfile = asyncHandler(async(req, res) => {
      const {username} = req.params
      
      if (!username?.trim()) {
         throw new ApiError(400, "Username is missing")
      }

      const channel = await User.aggregate([
      {
         $match: {
            username: username?.toLowerCase()
         }
      }, 
      {
         $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
         },
         
      },
      {
         $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "sunscriber",
            as: "subscribedTo"
         }
      },
      {
         $addFields: {
            subscriberCount: {
               $size: "$subscribers"
            },
            channelsSubscribedToCont: {
               $size: "$channel"
            },
            isSubscribed: {
               $cond:{
                  if: {$in: [req.user?._id,"$subscribers.subscriber"]},
                  then: true,
                  else: false
               }
            }
         },
      },
      {
         $project: {
            fullName: 1,
            username: 1,
            subscriberCount: 1,
            channelsSubscribedToCont: 1,
            isSubscribed: 1,
            avtar: 1,
            coverImage: 1,
            email: 1
         }
      } 
    ])

    if (!channel?.length) {
      throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
      new ApiResponse(200,channel[0],"User channel fatched successfully")
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
    updateUserAvtar,
    updateUserCoverImage, 
    getUserChannelProfile
   }