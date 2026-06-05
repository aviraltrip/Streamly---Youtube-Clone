import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {Like} from "../models/like.model.js"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query = "", sortBy = "createdAt", sortType = "desc", userId } = req.query
    
    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    
    if (pageNum < 1 || limitNum < 1) {
        throw new ApiError(400, "Page and limit must be positive numbers")
    }
    
    let matchStage = { isPublished: true }
    
    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid user id")
        }
        matchStage.owner = new mongoose.Types.ObjectId(userId)
    }
    
    if (query?.trim()) {
        matchStage.$or = [
            { title: { $regex: query.trim(), $options: "i" } },
            { description: { $regex: query.trim(), $options: "i" } }
        ]
    }
    
    const sortStage = {}
    const validSortByFields = ["createdAt", "views", "duration", "title"]
    const validSortTypes = ["asc", "desc"]
    
    const sortByField = validSortByFields.includes(sortBy) ? sortBy : "createdAt"
    const sortTypeValue = validSortTypes.includes(sortType) ? (sortType === "desc" ? -1 : 1) : -1
    sortStage[sortByField] = sortTypeValue
    
    const videoAggregate = Video.aggregate([
        {
            $match: matchStage
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "comments"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                commentsCount: {
                    $size: "$comments"
                },
                owner: {
                    $first: "$owner"
                },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                likes: 0,
                comments: 0
            }
        },
        {
            $sort: sortStage
        }
    ])
    
    const options = {
        page: pageNum,
        limit: limitNum
    }
    
    const videos = await Video.aggregatePaginate(videoAggregate, options)
    
    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Videos fetched successfully"))
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body
    
    if (!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "Title and description are required")
    }
    
    const videoLocalPath = req.files?.videoFile?.[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path
    
    if (!videoLocalPath) {
        throw new ApiError(400, "Video file is required")
    }
    
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail file is required")
    }
    
    const videoUploadResponse = await uploadOnCloudinary(videoLocalPath)
    const thumbnailUploadResponse = await uploadOnCloudinary(thumbnailLocalPath)
    
    if (!videoUploadResponse) {
        throw new ApiError(400, "Failed to upload video file")
    }
    
    if (!thumbnailUploadResponse) {
        throw new ApiError(400, "Failed to upload thumbnail file")
    }
    
    const video = await Video.create({
        videoFile: videoUploadResponse.url,
        thumbnail: thumbnailUploadResponse.url,
        title: title.trim(),
        description: description.trim(),
        duration: videoUploadResponse.duration || 0,
        owner: req.user._id,
        isPublished: true
    })
    
    const publishedVideo = await Video.findById(video._id).populate(
        "owner",
        "username fullName avatar"
    )
    
    if (!publishedVideo) {
        throw new ApiError(500, "Something went wrong while publishing the video")
    }
    
    return res
        .status(201)
        .json(new ApiResponse(201, publishedVideo, "Video published successfully"))
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }
    
    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "comments"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                commentsCount: {
                    $size: "$comments"
                },
                owner: {
                    $first: "$owner"
                },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                likes: 0,
                comments: 0
            }
        }
    ])
    
    if (!video || video.length === 0) {
        throw new ApiError(404, "Video not found")
    }
    
    if (req.user?._id && video[0].owner._id.toString() !== req.user._id.toString()) {
        await Video.findByIdAndUpdate(
            videoId,
            { $inc: { views: 1 } },
            { new: true }
        )
    }
    
    return res
        .status(200)
        .json(new ApiResponse(200, video[0], "Video fetched successfully"))
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description } = req.body
    
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }
    
    const video = await Video.findById(videoId)
    
    if (!video) {
        throw new ApiError(404, "Video not found")
    }
    
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this video")
    }
    
    const updateData = {}
    
    if (title?.trim()) {
        updateData.title = title.trim()
    }
    
    if (description?.trim()) {
        updateData.description = description.trim()
    }
    
    if (req.files?.thumbnail?.[0]?.path) {
        const thumbnailLocalPath = req.files.thumbnail[0].path
        const thumbnailUploadResponse = await uploadOnCloudinary(thumbnailLocalPath)
        
        if (!thumbnailUploadResponse) {
            throw new ApiError(400, "Failed to upload thumbnail")
        }
        
        updateData.thumbnail = thumbnailUploadResponse.url
    }
    
    if (Object.keys(updateData).length === 0) {
        throw new ApiError(400, "No fields to update")
    }
    
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        { $set: updateData },
        { new: true }
    ).populate("owner", "username fullName avatar")
    
    return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, "Video updated successfully"))
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }
    
    const video = await Video.findById(videoId)
    
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video")
    }
    
    await Video.findByIdAndDelete(videoId)
    
    await Like.deleteMany({ video: videoId })
    await Comment.deleteMany({ video: videoId })
    
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }
    
    const video = await Video.findById(videoId)
    
    if (!video) {
        throw new ApiError(404, "Video not found")
    }
    
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to toggle publish status of this video")
    }
    
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video.isPublished
            }
        },
        { new: true }
    ).populate("owner", "username fullName avatar")
    
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedVideo,
                `Video ${updatedVideo.isPublished ? "published" : "unpublished"} successfully`
            )
        )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}