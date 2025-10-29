import connectDB from "@/config/db";
import Order from "@/models/order";
import { inngest } from "@/config/inngest";
import Product from "@/models/product";
import User from "@/models/user";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { userId } = getAuth(request);
    const { address, items } = await request.json();

    if (!address || items.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Address and items are required",
      });
    }

    await connectDB();

    // Calculate amount
    let amount = 0;
    for (const item of items) {
      const product = await Product.findById(item.product);
      amount += product.offerPrice * item.quantity;
    }

    const total = amount + Math.floor(amount * 0.02);

    // 🔹 Create order immediately
    const order = await Order.create({
      userId,
      address,
      items,
      amount: total,
      date: Date.now(),
    });

    // 🔹 Clear cart
    const user = await User.findOne({ _id: userId });
    user.cartItems = [];
    await user.save();

    // 🔹 Send event for async tasks (email, notifications, etc.)
    await inngest.send({
      name: "order/created",
      data: { userId, address, items, amount: total, date: Date.now() },
    });

    return NextResponse.json({
      success: true,
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error.message,
    });
  }
}
