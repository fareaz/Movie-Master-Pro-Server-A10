const { MongoClient, ServerApiVersion } = require('mongodb');
const express =require("express")
const cors = require("cors")
const app = express()
const port = 3000

app.use(express.json())
app.use(cors())




const uri = "mongodb+srv://Movie-Master-Pro:VAfv2AUZORcyoWrg@cluster0.5rsc2du.mongodb.net/?appName=Cluster0";


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
 
    await client.connect();
   
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    
    // await client.close();
  }
}
run().catch(console.dir);



app.get("/",(req,res)=>{
    res.send("server connect")
})
app.listen(port,()=>{
    console.log(`app running on port ${port}`)
}) 