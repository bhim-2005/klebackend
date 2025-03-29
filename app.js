const express = require('express');
const app = express();
const mongoose = require('mongoose');

const { User } = require('./model/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const morgan = require('morgan');
const { Product } = require("./model/Product");
const { Cart } = require('./model/Cart');

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

mongoose.connect('mongodb://127.0.0.1:27017/kleEcom')
  .then(() => {
    console.log('db connected');
  }).catch((err) => {
    console.log('db is not connected', err);
  });


// Task-1 -> Create route for user registration
app.post('/register', async (req, res) => {
  try {
    let { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Please enter all fields'
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({
        message: 'User already has an account'
      });
    } else {
      // Hash the password
      let salt = await bcrypt.genSalt(10);
      let hashPassword = await bcrypt.hash(password, salt);

      // Generate token
      const token = jwt.sign({ email }, "supersecret", { expiresIn: '365d' });

      // Create user
      await User.create({
        name,
        email,
        password: hashPassword,
        token,
        role: 'user'
      });

      return res.status(200).json({
        message: "User is created successfully"
      });
    }

  } catch (error) {
    console.log(error);
    res.status(400).json({ message: 'Internal Server Error' });
  }
});

// Task-2 -> Create route for user login
app.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        message: 'Please enter all fields'
      });
    }

    // Check if user exists or not
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        message: 'User is not registered, please register first'
      });
    }

    // Compare the entered password
    let isPasswordMatched = bcrypt.compareSync(password, user.password);
    if (!isPasswordMatched) {
      return res.status(400).json({
        message: "Invalid Password"
      });
    }

    return res.status(200).json({
      message: "User is logged in successfully",
      id: user._id,
      name: user.name,
      token: user.token,
      email: user.email,
      role: user.role
    });

  } catch (error) {
    console.log(error);
    res.status(400).json({ message: 'Internal Server Error' });
  }
});

// Task-3 -> Get Products
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json({
      products: products
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: 'Internal Server Error' });
  }
});

// Task-4 -> Add a product
app.post('/add-product', async (req, res) => {
  try {
    let { name, image, price, description, stock, brand } = req.body;
    let { token } = req.headers;
    let decodedToken = jwt.verify(token, "supersecret");
    let user = await User.findOne({ email: decodedToken.email });

      product = await Product.create({
      name,
      description,
      image,
      price,
      stock,
      brand,
      user: user._id
    });

    return res.status(200).json({
      message: "Product created successfully",
      product: product
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server Error" });
  }
});

// Task-5 -> To show the particular product
app.get('/product/:id', async (req, res) => {
  try {
    let { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Product Id not found" });
    }

    const { token } = req.headers;
    const decodedToken = jwt.verify(token, "supersecret");

    // Ensure token is valid
    if (!decodedToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(400).json({
        message: "Product not found"
      });
    }

    return res.status(200).json({
      product: product
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Task-6: Create route to update a product
app.patch("/product/edit/:id", async (req, res) => {
     const { id } = req.params;
     const { token } = req.headers;
     const body = req.body.productData;
     const { name, description, image, price, brand, stock } = body;
   
     try {
       const userEmail = jwt.verify(token, 'supersecret');
       if (userEmail.email) {
         const updatedProduct = await Product.findByIdAndUpdate(id, {
           name,
           description,
           image,
           price,
           brand,
           stock,
         });
         res.status(200).json({ message: 'Product Updated Successfully' });
       }
     } catch (error) {
       res.status(400).json({ message: 'Internal Server Error Occurred While Updating Product' });
     }
   });

// Task-7 -> Create route to delete product
app.delete('/product/delete/:id', async (req, res) => {
  try {
    let { id } = req.params;
    let { token } = req.headers;
    let decodedToken = jwt.verify(token, "supersecret");

    if (!decodedToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (decodedToken.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden: You do not have permission to delete this product" });
    }

    let deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    res.status(200).json({
      message: "Product Deleted Successfully",
      product: deletedProduct
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Task-8 -> Create route to see all products in cart
app.get('/cart', async (req, res) => {
  try {
    let { token } = req.headers;
    let decodedToken = jwt.verify(token, "supersecret");
    const user = await User.findOne({ email: decodedToken.email }).populate({
      path: 'cart',
      populate: {
        path: 'products',
        model: 'Product'
      }
    });

    if (!user) {
      return res.status(400).json({
        message: "User not found"
      });
    }

    return res.status(200).json({
      cart: user.cart
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Task-9 -> Create route to add product in cart
app.post('/cart/add', async (req, res) => {
  try {
    const body = req.body;
    const productArray = body.products;
    let totalPrice = 0;

    // Find the product and add product price to total
    for (let item of productArray) {
      const product = await Product.findById(item);
      if (product) {
        totalPrice += product.price;
      }
    }

    let { token } = req.headers;
    let decodedToken = jwt.verify(token, 'supersecret');
    const user = await User.findOne({ email: decodedToken.email });

    if (!user) {
      return res.status(400).json({
        message: "User not found"
      });
    }

    let cart;
    if (user.cart) {
      cart = await Cart.findById(user.cart).populate('products');
      const existingProductIds = cart.products.map((product) => product._id.toString());

      productArray.forEach(async (productId) => {
        if (!existingProductIds.includes(productId)) {
          cart.products.push(productId);
          const product = await Product.findById(productId);
          totalPrice += product.price;
        }
      });

      cart.total = totalPrice;
      await cart.save();
    } else {
      cart = new Cart({
        products: productArray,
        total: totalPrice
      });
      await cart.save();
      user.cart = cart._id;
      await user.save();
    }

    return res.status(200).json({
      message: "Cart updated successfully",
      cart: cart
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// task-10 create a route to delete product in cart
app.delete("/cart/product/delete", async (req, res) => {
  try{
  const { productID } = req.body;
  const { token } = req.headers;
  const decodedToken = jwt.verify(token, "supersecret");
  const user = await User.findOne({ email: decodedToken.email }).populate('cart')
  if (!user) {
  return res.status(404).json({ message: "User Not Found" });
  }
  const cart = await Cart.findById(user.cart).populate("products");
 if (!cart) {
 return res.status(404).json({ message: "Cart Not Found" });
 }
 const productIndex = cart.products.findIndex(
  (product) => product._id.toString() === productID
  );
  if (productIndex === -1) {
    return res.status(404).json({ message: "Product Not Found in Cart" });
    }
    cart.products.splice(productIndex, 1);
    cart.total = cart.products.reduce(
    (total, product) => total + product.price,
    0
    );
    await cart.save();
    res.status(200).json({
    message: "Product Removed from Cart Successfully",
    cart: cart,
    });
    } catch (error) {
    res   
    .status(500)
    .json({ message: "Error Removing Product from Cart", error });
    }
   });

let PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server is connected to port ${PORT}`);
});
