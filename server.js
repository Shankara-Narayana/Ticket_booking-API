const express = require("express");
const axios = require("axios"); /*Axios is used in the Ticket Company API 
                                  because it has to call APIs from other companies. 
                                  This matches the Node.js API architecture idea 
                                  where one Node.js API may call external APIs using 
                                  HTTP clients like Axios*/

const app = express();
app.use(express.json());

let tickets = [];

// External company API URLs
const THEATER_API_URL = "http://localhost:3001";
const PAYMENT_API_URL = "http://localhost:3002";

/*
BOOK TICKET API
This communicates with:
1. Theater Company API
2. Payment Company API
*/
app.post("/ticket/book", async (req, res) => {
  const { customerName, seatNumber, amount } = req.body;

  if (!customerName || !seatNumber || !amount) {
    return res.status(400).json({
      message: "customerName, seatNumber and amount are required"
    });
  }

  try {
    // Step 1: Book seat from Theater Company
    const seatResponse = await axios.post(`${THEATER_API_URL}/seats/book`, {
      seatNumber
    });

    try {
      // Step 2: Make payment from Payment Company
      const paymentResponse = await axios.post(`${PAYMENT_API_URL}/payment/pay`, {
        customerName,
        amount
      });

      // Step 3: Create ticket in Ticket Company
      const ticket = {
        ticketId: Date.now(),
        customerName,
        seatNumber,
        amount,
        paymentId: paymentResponse.data.paymentId,
        ticketStatus: "BOOKED"
      };

      tickets.push(ticket);

      return res.status(201).json({
        message: "Ticket booked successfully",
        seatDetails: seatResponse.data,
        paymentDetails: paymentResponse.data,
        ticket
      });

    } catch (paymentError) {
      // If payment fails, release the booked seat
      await axios.post(`${THEATER_API_URL}/seats/release`, {
        seatNumber
      });

      return res.status(400).json({
        message: "Payment failed, so seat has been released",
        error: paymentError.response?.data || paymentError.message
      });
    }

  } catch (seatError) {
    return res.status(400).json({
      message: "Seat booking failed",
      error: seatError.response?.data || seatError.message
    });
  }
});

/*
CANCEL TICKET API
This communicates with:
1. Payment Company API for refund
2. Theater Company API for seat release
*/
app.post("/ticket/cancel", async (req, res) => {
  const { ticketId } = req.body;

  if (!ticketId) {
    return res.status(400).json({
      message: "ticketId is required"
    });
  }

  const ticket = tickets.find(t => t.ticketId === ticketId);

  if (!ticket) {
    return res.status(404).json({
      message: "Ticket not found"
    });
  }

  if (ticket.ticketStatus === "CANCELLED") {
    return res.status(400).json({
      message: "Ticket already cancelled"
    });
  }

  try {
    // Step 1: Refund from Payment Company
    const refundResponse = await axios.post(`${PAYMENT_API_URL}/payment/refund`, {
      paymentId: ticket.paymentId,
      amount: ticket.amount
    });

    // Step 2: Release seat from Theater Company
    const seatReleaseResponse = await axios.post(`${THEATER_API_URL}/seats/release`, {
      seatNumber: ticket.seatNumber
    });

    // Step 3: Update ticket status
    ticket.ticketStatus = "CANCELLED";

    res.json({
      message: "Ticket cancelled successfully",
      refundDetails: refundResponse.data,
      seatUpdateDetails: seatReleaseResponse.data,
      ticket
    });

  } catch (error) {
    res.status(400).json({
      message: "Ticket cancellation failed",
      error: error.response?.data || error.message
    });
  }
});

// Get all tickets
app.get("/tickets", (req, res) => {
  res.json({
    message: "Tickets fetched successfully",
    tickets
  });
});

app.listen(3003, () => {
  console.log("Ticket Company API running on port 3003");
});