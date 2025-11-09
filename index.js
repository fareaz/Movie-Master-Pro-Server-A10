const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({
      message: "unauthorized access. Token not found!",
    });
  }

  const token = authorization.split(" ")[1];
  try {
    await admin.auth().verifyIdToken(token);

    next();
  } catch (error) {
    res.status(401).send({
      message: "unauthorized access.",
    });
  }
};

async function run() {
  try {
       await client.connect();
       const db = client.db("MovieMaster-db");
       const movieCollection = db.collection("movies");

      app.get("/movies", async (req, res) => {
      const result = await movieCollection.find().toArray();
      res.send(result);
    });

      app.get("/movieDetails/:id",async (req, res) => {
        const {id }= req.params;
        const _id = new ObjectId(id);
        const result = await movieCollection.findOne({ _id});
         res.send({
        success: true,
        result,
      });  
  });

//delete
 app.delete("/movies/:id",  async (req, res) => {
      const { id } = req.params;
      const result = await movieCollection.deleteOne({ _id: new ObjectId(id) });

      res.send({
        success: true,
        result,
      });
    });
 


    
      app.post("/movies",   async (req, res) => {
      const data = req.body;
      const result = await movieCollection.insertOne(data);
      res.send({
        success: true,
        result,
      });
    });


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