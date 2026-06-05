import mongoose from "mongoose"
import { Video } from "../models/video.model.js"
import { Subscription } from "../models/subscription.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    const channelId = req.user?._id

    if (!channelId) {
        throw new ApiError(401, "Unauthorized request")
    }

    const totalSubscribers = await Subscription.countDocuments({
        channel: channelId
    })

    const videoStats = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(channelId)
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
            $group: {
                _id: null,
                totalViews: {
                    $sum: "$views"
                },
                totalVideos: {
                    $sum: 1
                },
                totalLikes: {
                    $sum: {
                        $size: "$likes"
                    }
                },
                totalComments: {
                    $sum: {
                        $size: "$comments"
                    }
                }
            }
        }
    ])

    const stats = videoStats[0] || {
        totalViews: 0,
        totalVideos: 0,
        totalLikes: 0,
        totalComments: 0
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    totalSubscribers,
                    totalViews: stats.totalViews,
                    totalVideos: stats.totalVideos,
                    totalLikes: stats.totalLikes,
                    totalComments: stats.totalComments
                },
                "Channel stats fetched successfully"
            )
        )
})

const getChannelVideos = asyncHandler(async (req, res) => {
    const channelId = req.user?._id

    if (!channelId) {
        throw new ApiError(401, "Unauthorized request")
    }

    const videos = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(channelId)
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
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                commentsCount: {
                    $size: "$comments"
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
            $sort: {
                createdAt: -1
            }
        }
    ])

    return res
        .status(200)
        .json(
            new ApiResponse(200, videos, "Channel videos fetched successfully")
        )
})

export {
    getChannelStats,
    getChannelVideos
}
