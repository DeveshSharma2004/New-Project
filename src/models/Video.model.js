import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const  VideoSchema = new Schema (
    {
        VideoFile: {
            type: String,
            require: true,
        },
        thumbnail: {
            type: String,
            require: true,
        },
        title: {
            type: String,
            require: true,
        },
           discription: {
            type: String,
            require: true,
        },
        duration: {
            type: Number,
            require: true
        },
        view: {
            type: Number,
            default: 0
        },
        isPublished: {
            type: Boolean,
            default: true,
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {
        timestamps: true
    }
)
VideoSchema.plugin(mongooseAggregatePaginate)


export  const Video = mongoose.model("Vudeo", VideoSchema)