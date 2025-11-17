const { default: mongoose } = require("mongoose")

const connectDB = async()=>{
    try {
       await mongoose.connect(process.env.MONGO_URI) 
       console.log('Mongo Connected')
    } catch (error) {
         console.log('DB Connection Failed:', error.message)
         process.exit(1);
    }
}
module.exports = connectDB