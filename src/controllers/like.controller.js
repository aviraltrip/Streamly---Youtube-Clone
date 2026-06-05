import mongoose, { isValidObjectId } from "mongoose"
import { Like } from "../models/like.model.js"
import { Video } from "../models/video.model.js"
import { Comment } from "../models/comment.model.js"
import { Tweet } from "../models/tweet.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    const isLiked = await Like.findOne({
        video: videoId,
        likedBy: req.user?._id
    })

    if (isLiked) {
        await Like.findByIdAndDelete(isLiked._id)

        return res
            .status(200)
            .json(
                new ApiResponse(200, { isLiked: false }, "Video unliked successfully")
            )
    }

    await Like.create({
        video: videoId,
        likedBy: req.user?._id
    })

    return res
        .status(200)
        .json(
            new ApiResponse(200, { isLiked: true }, "Video liked successfully")
        )
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment id")
    }

    const comment = await Comment.findById(commentId)

    if (!comment) {
        throw new ApiError(404, "Comment not found")
    }

    const isLiked = await Like.findOne({
        comment: commentId,
        likedBy: req.user?._id
    })

    if (isLiked) {
        await Like.findByIdAndDelete(isLiked._id)

        return res
            .status(200)
            .json(
                new ApiResponse(200, { isLiked: false }, "Comment unliked successfully")
            )
    }

    await Like.create({
        comment: commentId,
        likedBy: req.user?._id
    })

    return res
        .status(200)
        .json(
            new ApiResponse(200, { isLiked: true }, "Comment liked successfully")
        )
})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet id")
    }

    const tweet = await Tweet.findById(tweetId)

    if (!tweet) {
        throw new ApiError(404, "Tweet not found")
    }

    const isLiked = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user?._id
    })

    if (isLiked) {
        await Like.findByIdAndDelete(isLiked._id)

        return res
            .status(200)
            .json(
                new ApiResponse(200, { isLiked: false }, "Tweet unliked successfully")
            )
    }

    await Like.create({
        tweet: tweetId,
        likedBy: req.user?._id
    })

    return res
        .status(200)
        .json(
            new ApiResponse(200, { isLiked: true }, "Tweet liked successfully")
        )
})

const getLikedVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query

    const likedVideosAggregate = Video.aggregate([
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $addFields: {
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                },
                likesCount: {
                    $size: "$likes"
                }
            }
        },
        {
            $match: {
                isLiked: true
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
                owner: {
                    $first: "$owner"
                }
            }
        },
        {
            $project: {
                likes: 0
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        }
    ])

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    }

    const likedVideos = await Video.aggregatePaginate(
        likedVideosAggregate,
        options
    )

    return res
        .status(200)
        .json(
            new ApiResponse(200, likedVideos, "Liked videos fetched successfully")
        )
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}
