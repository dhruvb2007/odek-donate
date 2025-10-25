export interface Event {
  id: string;
  name: string;
  description?: string;
  currentAmount: number;
  totalVisitors: number;
  adminPassword: string;
  visitorPassword: string;
  createdAt: Date;
  imageUrl?: string;
}

export interface Donation {
  id: string;
  eventId: string;
  donorName: string;
  amount: number;
  message?: string;
  createdAt: Date;
}
