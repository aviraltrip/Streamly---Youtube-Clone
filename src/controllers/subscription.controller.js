import mongoose, { isValidObjectId } from "mongoose"
import { User } from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel id")
    }

    if (channelId.toString() === req.user._id.toString()) {
        throw new ApiError(400, "You cannot subscribe to your own channel")
    }

    const channel = await User.findById(channelId)

    if (!channel) {
        throw new ApiError(404, "Channel not found")
    }

    const isSubscribed = await Subscription.findOne({
        subscriber: req.user._id,
        channel: channelId
    })

    if (isSubscribed) {
        await Subscription.findByIdAndDelete(isSubscribed._id)

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    { isSubscribed: false },
                    "Channel unsubscribed successfully"
                )
            )
    }

    await Subscription.create({
        subscriber: req.user._id,
        channel: channelId
    })

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isSubscribed: true },
                "Channel subscribed successfully"
            )
        )
})

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel id")
    }

    const channel = await User.findById(channelId)

    if (!channel) {
        throw new ApiError(404, "Channel not found")
    }

    const subscribers = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
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
                subscriber: {
                    $first: "$subscriber"
                }
            }
        },
        {
            $project: {
                subscriber: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ])

    return res
        .status(200)
        .json(
            new ApiResponse(200, subscribers, "Subscribers fetched successfully")
        )
})

const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params

    if (!isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber id")
    }

    const subscriber = await User.findById(subscriberId)

    if (!subscriber) {
        throw new ApiError(404, "Subscriber not found")
    }

    const subscribedChannels = await Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channel",
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
                channel: {
                    $first: "$channel"
                }
            }
        },
        {
            $project: {
                channel: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ])

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                subscribedChannels,
                "Subscribed channels fetched successfully"
            )
        )
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}
