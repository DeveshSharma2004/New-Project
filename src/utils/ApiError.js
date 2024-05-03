class ApiError extends Error{
    constructor(
        statuscode,
        message= "something want wrong",
        errors = [],
        statck = ""
    ){
        super(message)
        this.statuscode = statuscode
        this.date = null
        this.message = message
        this.success = false
        this.errors = errors

        if (statck) {
         this.stack = statck  
        } else {
            Error.captureStackTrace(this,this.constructor)
        }
    }
}

export {ApiError}