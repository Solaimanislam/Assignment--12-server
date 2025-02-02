const express = require('express');
require('dotenv').config()
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ysdrtdj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const userCollection = client.db("DiagnosticDB").collection('users');
        const testCollection = client.db("DiagnosticDB").collection('test');
        const reviewCollection = client.db("DiagnosticDB").collection('reviews');
        const bookedCollection = client.db("DiagnosticDB").collection('booked');
        const paymentCollection = client.db("DiagnosticDB").collection('payments');
        const bannerCollection = client.db("DiagnosticDB").collection('banners');
        const cartCollection = client.db("DiagnosticDB").collection('carts');

        // JWT related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })

        // middle ware
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                res.status(401).send({ message: 'unauthorized access  ' });
            }
            const token = req.headers.authorization.split(' ')[1];
            // console.log(token);
            // console.log(process.env.ACCESS_TOKEN_SECRET);
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            clg
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // carts collection
        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await cartCollection.insertOne(cartItem);
            res.send(result);
        } )

        // users related api

        app.get('/users', async (req, res) => {

            const result = await userCollection.find().toArray();
            res.send(result);
        })

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" })

            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin })
        })

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })


        app.patch('/users/active/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'blocked'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })




        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user does not exists
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        // banner related api
        app.post('/banner', verifyToken, verifyAdmin, async (req, res) => {
            const item = req.body;
            const result = await bannerCollection.insertOne(item);
            res.send(result);
        })

        app.get('/banner', verifyToken, verifyAdmin, async (req, res) => {
            const result = await bannerCollection.find().toArray();
            res.send(result);
        })

        app.delete('/banner/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bannerCollection.deleteOne(query);
            res.send(result);
        })

        // test related api
        app.get('/test', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await testCollection.find(query).toArray();
            res.send(result);

        })

        // get all test data for pagination
        app.get('/all-test', async (req, res) => {
            const size = parseInt(req.query.size);
            const page = parseInt(req.query.page);
            const filter = req.query.filter;
            const sort = req.query.sort;
            console.log(sort);
            // const search = req.query.search;
            console.log(size, page);

            // let query = {
            //     test_title: { $regex: search}
            // }
            if (filter) query.duration =  filter 
            
            
            const result = await testCollection.find({}).sort({date : sort === 'asc' ? 1 : -1}).skip(page * size).limit(size).toArray();
            console.log(result.length);
            res.send(result);
        })

        // get all test data for db count
        app.get('/test-count', async (req, res) => {
            const filter = req.query.filter;
            // const search = req.query.search;
            // let query = {
            //     test_title: { $regex: search}
            // }
            if (filter) query.duration =  filter 
            const count = await testCollection.countDocuments(query)
            res.send({ count });
        })

        // update test item
        app.get('/test/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await testCollection.findOne(query);
            res.send(result);
        })

        app.post('/test', verifyToken, verifyAdmin, async (req, res) => {
            const item = req.body;
            const result = await testCollection.insertOne(item);
            res.send(result);
        })

        app.patch('/test/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    title: item.title,
                    price: item.price,
                    date: item.date,
                    slots: item.slots,
                    short_description: item.short_description,
                    image: item.image
                }
            }
            const result = await testCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/test/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await testCollection.deleteOne(query);
            res.send(result);
        })

        // booked collections
        app.get('/booked', async (req, res) => {
            const result = await bookedCollection.find().toArray();
            res.send(result);
        })

        app.get('/payment', async (req, res) => {
            const result = await paymentCollection.find().toArray();
            res.send(result);
        })

        app.patch('/payment/cancel/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'canceled'
                }
            }
            const result = await paymentCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        })

        // app.get('/payments/:email', verifyToken, async (req, res) => {
        //     const query = { email: req.params.email }
        //     if (req.params.email !== req.decoded.email) {
        //         return res.status(403).send({ message: 'Forbidden Access' })
        //     }
        //     const result = await paymentCollection.find(query).toArray();
        //     res.send(result);
        // })

        app.post('/booked', async (req, res) => {
            const bookedItem = req.body;
            const result = await bookedCollection.insertOne(bookedItem);
            res.send(result);
        })

        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100)
            console.log(amount, 'amount inside the intent');

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);

            // carefully delete each item from the cart
            console.log('payment info', payment);
            res.send(paymentResult);
            const query = {
                _id: {

                    $in: payment.cartIds.map(id => new ObjectId(id))
                }
            };

            const deleteResult = await bookedCollection.deleteMany(query);

            res.send({ paymentResult, deleteResult });


        })

        // states or analytics
        app.get('/admin-states', verifyToken, verifyAdmin, async (req, res) => {
            const users = await userCollection.estimatedDocumentCount();
            const testItems = await testCollection.estimatedDocumentCount();
            const bookedItems = await bookedCollection.estimatedDocumentCount();
            // const payments = await paymentCollection.find().toArray();
            // const revenue = payments.reduce((total, payment) => total + payment.price, 0)
            const result = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: '$price'
                        }
                    }
                }
            ]).toArray();
            const revenue = result.length > 0 ? result[0].totalRevenue : 0;
            res.send({
                users,
                testItems,
                bookedItems,
                revenue
            })
        })



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Assignment is running');
})

app.listen(port, () => {
    console.log(`Assignment is running on port ${port}`);
})