const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({

name:{
type:String,
required:true
},

category:{
type:String
},

buyPrice:{
type:Number,
required:true
},

sellPrice:{
type:Number,
required:true
},

stock:{
type:Number,
default:0
},

minStock:{
type:Number,
default:10
}

},{
timestamps:true
});

module.exports =
mongoose.model(
"Product",
productSchema
);