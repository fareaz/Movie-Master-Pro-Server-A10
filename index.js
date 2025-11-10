const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./masterKey.json");
const express = require("express");
const cors = require("cors");
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri =
  "mongodb+srv://Movie-Master-Pro:VAfv2AUZORcyoWrg@cluster0.5rsc2du.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  // console.log(authorization)

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
    const watchCollection = db.collection("watchLists");
    const usersCollection = db.collection("users");

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const email = req.body.email;
      const query = { email: email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        res.send({
          message: "user already exits. do not need to insert again",
        });
      } else {
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      }
    });
    app.get("/stats", async (req, res) => {
      const totalMovies = await movieCollection.countDocuments();
      const totalUsers = await usersCollection.countDocuments();
      res.send({ success: true, totalMovies, totalUsers });
    });
    app.get("/filter-movies", async (req, res) => {
      try {
        const { genres, minRating, maxRating } = req.query;
        const query = {};

        if (genres) {
          const genreArray = genres
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean);
          query.genre = { $in: genreArray };
        }

        if (minRating || maxRating) {
          query.rating = {};
          if (minRating) query.rating.$gte = Number(minRating);
          if (maxRating) query.rating.$lte = Number(maxRating);
        }

        const result = await movieCollection
          .find(query)
          .sort({ rating: -1 })
          .toArray();
        res.send({ success: true, count: result.length, result });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    app.get("/movies", async (req, res) => {
      const result = await movieCollection
        .find()
        .sort({ releaseYear: -1 })
        .toArray();
      res.send(result);
    });
    app.get("/hero", async (req, res) => {
      const result = await movieCollection
        .find()
        .sort({ created_at: -1 })
        .limit(5)
        .toArray();
      res.send(result);
    });
    app.get("/top-rate", async (req, res) => {
      const result = await movieCollection
        .aggregate([
          {
            $addFields: {
              numericRating: { $toDouble: "$rating" },
            },
          },
          { $sort: { numericRating: -1 } },
          { $limit: 5 },
        ])
        .toArray();

      res.send(result);
    });

    app.get("/movieDetails/:id", async (req, res) => {
      const { id } = req.params;
      const _id = new ObjectId(id);
      const result = await movieCollection.findOne({ _id });
      res.send({
        success: true,
        result,
      });
    });

    //delete
    app.delete("/movies/:id", async (req, res) => {
      const { id } = req.params;
      const result = await movieCollection.deleteOne({ _id: new ObjectId(id) });

      res.send({
        success: true,
        result,
      });
    });
    //update
    app.put("/movie/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      const objectId = new ObjectId(id);
      const filter = { _id: objectId };
      const update = {
        $set: data,
      };
      const result = await movieCollection.updateOne(filter, update);

      res.send({
        success: true,
        result,
      });
    });
    //my movies
    app.get("/my-movies", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await movieCollection.find({ addedBy: email }).toArray();
      res.send(result);
    });

    app.post("/watch-list/", async (req, res) => {
      const data = req.body;
      const result = await watchCollection.insertOne(data);
      res.send({ result });
    });
    app.get("/my-watch-list", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await watchCollection
        .find({ addedBy: email })
        .sort({
          created_at: -1,
        })
        .toArray();
      res.send(result);
    });
    app.delete("/watch-list/:id", async (req, res) => {
      const { id } = req.params;
      const result = await watchCollection.deleteOne({ _id: id });
      res.send({
        success: true,
        result,
      });
    });

    app.post("/movies", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await movieCollection.insertOne(data);
      res.send({
        success: true,
        result,
      });
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server connect");
});
app.listen(port, () => {
  console.log(`app running on port ${port}`);
});
