import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import POSDashboard from './POSDashboard'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import TransactionDetails from './TransactionDetails'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import OrderHistoryPage from './OrderHistoryPage'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import AddMenuItemPage from './AddMenuItemPage'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import DeliveryTracking from './DeliveryTracking'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import RestaurantLogin from './RestaurantLogin'




function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<POSDashboard />} />
        <Route path="/POSDashboard" element={<POSDashboard />} />
        <Route path="/transaction-details" element={<TransactionDetails />} />
        <Route path="/delivery-tracking" element={<DeliveryTracking />} />
        <Route path="/order-history" element={<OrderHistoryPage />} />
        <Route path="/add-menu-item" element={<AddMenuItemPage />} />
        <Route path="/restaurant-login" element={<RestaurantLogin />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App




