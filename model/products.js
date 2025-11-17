    const mongoose = require("mongoose")

    const colorVariantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    hex: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^#[0-9A-F]{6}$/i.test(v);
        },
        message: (props) => `${props.value} is not a valid hex color!`,
      },
    },
    images: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return v.length > 0 && v.length <= 4;
        },
        message: "Each color must have between 1 and 4 images",
      },
    },
  },
  { _id: false }
);

    const productSchema = new mongoose.Schema({
        title : {type : String, required : true},
        slug : {type: String, required : true, unique:true},
        price:{type : Number, required : true},
        description : {type : String},
        images : [{type : String}],
        category : {type : mongoose.Schema.Types.ObjectId, ref : "category"},
        discount : {type : Number},
        brand : {type : String},
        stock : {type:Number},
        colors: [colorVariantSchema],

    },{timestamps : true})

    module.exports = mongoose.model("products", productSchema)