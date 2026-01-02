const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./masterKey.json");
const express = require("express");
require("dotenv").config()
const cors = require("cors");
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


const uri =
  `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.5rsc2du.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
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
const verifyAdmin = async (req, res, next) => {
  const email = req.user?.email;

  if (email !== "Admin@gmail.com") {
    return res.status(403).send({ message: "Forbidden access" });
  }

  const user = await usersCollection.findOne({ email });

  if (!user || user.role !== "admin") {
    return res.status(403).send({ message: "Admin access required" });
  }

  next();
};

// const verifyToken = async (req, res, next) => {
//   const authorization = req.headers.authorization;

//   if (!authorization) {
//     return res.status(401).send({
//       message: "unauthorized access. Token not found!",
//     });
//   }

//   const token = authorization.split(" ")[1];

//   try {
//     const decoded = await admin.auth().verifyIdToken(token);

//     // ✅ THIS LINE WAS MISSING
//     req.user = decoded;

//     next();
//   } catch (error) {
//     return res.status(401).send({
//       message: "unauthorized access.",
//     });
//   }
// };

async function run() {
  try {
    // await client.connect();
    const db = client.db("MovieMaster-db");
    const movieCollection = db.collection("movies");
    const watchCollection = db.collection("watchLists");
    const usersCollection = db.collection("users");

    app.get("/stats", async (req, res) => {
      const totalMovies = await movieCollection.countDocuments();
      const totalUsers = await usersCollection.countDocuments();
      res.send({ success: true, totalMovies, totalUsers });
    });
    app.get("/filter-movies", async (req, res) => {
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
    });
    app.get("/search", async (req, res) => {
      const search_text = req.query.search;
      const result = await movieCollection
        .find({ title: { $regex: search_text, $options: "i" } })
        .toArray();
      res.send(result);
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
    app.get("/my-movies",  async (req, res) => {
      const email = req.query.email;
      const result = await movieCollection.find({ addedBy: email }).toArray();
      res.send(result);
    });
    app.get("/my-watch-list", async (req, res) => {
      const email = req.query.email;
      const result = await watchCollection
        .find({ addedBy: email })
        .sort({
          created_at: -1,
        })
        .toArray();
      res.send(result);
    });
      app.post("/watch-list/", async (req, res) => {
      const data = req.body;
      const result = await watchCollection.insertOne(data);
      res.send({ result });
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
   app.delete("/watch-list/:id",  async (req, res) => {
  try {
    const { id } = req.params;
    const ownerEmail = req.user?.email || req.query.email || null;
    let filter = null;
    try {
      filter = { _id: new ObjectId(id) };
    } catch (e) {
      
      filter = { movieId: String(id) };
    }
    if (ownerEmail) filter.addedBy = ownerEmail;
    const result = await watchCollection.deleteOne(filter);
    if (result.deletedCount === 0) {
      return res.send({
        success: false,
      });
    }

    res.send({ success: true, result });
  } catch (err) {
    console.error("DELETE /watch-list/:id error:", err);
    res.status(500).send({ success: false, message: "Server error" });
  }
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
    //post
    app.post("/watch-list/", async (req, res) => {
      const data = req.body;
      const result = await watchCollection.insertOne(data);
      res.send({ result });
    });
    app.post("/movies", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await movieCollection.insertOne(data);
      res.send({
        success: true,
        result,
      });
    });
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
app.get("/users", async (req, res) => {
  const email = req.query.email;

  if (email !== "admin@gmail.com") {
    return res.status(403).send({ message: "Forbidden access" });
  }

  const adminUser = await usersCollection.findOne({ email });

  if (!adminUser || adminUser.role !== "admin") {
    return res.status(403).send({ message: "Not an admin" });
  }

  const users = await usersCollection.find().toArray();
  res.send(users);
});
app.patch("/users/role/:id", async (req, res) => {
  const { role, adminEmail } = req.body;

  if (adminEmail !== "admin@gmail.com") {
    return res.status(403).send({ message: "Forbidden" });
  }

  const admin = await usersCollection.findOne({ email: adminEmail });

  if (admin?.role !== "admin") {
    return res.status(403).send({ message: "Not admin" });
  }

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { role } }
  );

  res.send(result);
});
app.delete("/users/:id", async (req, res) => {
  const adminEmail = req.query.email;

  if (adminEmail !== "admin@gmail.com") {
    return res.status(403).send({ message: "Forbidden" });
  }

  const admin = await usersCollection.findOne({ email: adminEmail });

  if (admin?.role !== "admin") {
    return res.status(403).send({ message: "Not admin" });
  }

  const result = await usersCollection.deleteOne({
    _id: new ObjectId(req.params.id),
  });

  res.send(result);
});
app.get("/admin/movies", async (req, res) => {
  const email = req.query.email;

  // admin check
  const admin = await usersCollection.findOne({ email });

  if (!admin || admin.role !== "admin") {
    return res.status(403).send({ message: "Forbidden" });
  }

  const movies = await movieCollection
    .find()
    .sort({ created_at: -1 })
    .toArray();

  res.send(movies);
});
app.patch("/admin/movies/:id", async (req, res) => {
  const { id } = req.params;
  const { email, _id, ...updateData } = req.body; // 🔥 _id বাদ দাও

  const admin = await usersCollection.findOne({ email });

  if (!admin || admin.role !== "admin") {
    return res.status(403).send({ message: "Forbidden" });
  }

  const result = await movieCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updateData }
  );

  res.send(result);
});
app.delete("/admin/movies/:id", async (req, res) => {
  const email = req.query.email;

  const admin = await usersCollection.findOne({ email });

  if (!admin || admin.role !== "admin") {
    return res.status(403).send({ message: "Forbidden" });
  }

  const result = await movieCollection.deleteOne({
    _id: new ObjectId(req.params.id),
  });

  res.send(result);
});
app.get("/users/profile/:email", async (req, res) => {
  const email = req.params.email;

  const user = await usersCollection.findOne({ email });

  if (!user) {
    return res.status(404).send({ message: "User not found" });
  }

  res.send(user);
});
app.patch("/users/profile/:email", async (req, res) => {
  const email = req.params.email;
  const { name, photoURL } = req.body;

  const result = await usersCollection.updateOne(
    { email },
    {
      $set: {
        name,
        photoURL,
      },
    }
  );

  res.send(result);
});
 app.get("/users/:email/role",  async (req, res) => {
  const email = req.params.email;

  

  const user = await usersCollection.findOne({ email });

  res.send({
    role: user?.role ,
  });
});
    // await client.db("admin").command({ ping: 1 });
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
