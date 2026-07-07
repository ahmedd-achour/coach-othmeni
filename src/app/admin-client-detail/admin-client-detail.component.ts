import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface IntakeData {
  age: number;
  weight: number;
  targetWeight: number;
  medicalConditions: string[];
  allergies: string[];
  dietaryPreference: string;
  activityLevel: string;
  goals: string;
}

interface ClientProfile {
  id: string;
  fullName: string;
  email: string;
  status: 'Pending Plan' | 'Active' | 'Check-in Needed' | 'Expired';
  paymentMethod: 'Stripe' | 'PayPal';
  amountPaid: string;
  joinedDate: string;
  intake: IntakeData;
}

@Component({
  selector: 'app-admin-client-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-client-detail.component.html',
  styleUrls: ['./admin-client-detail.component.css']
})
export class AdminClientDetailComponent implements OnInit {
  // Mocking data coming from Firestore for a Dubai premium client
  client: ClientProfile = {
    id: 'USR_98724',
    fullName: 'Youssef Al-Mansoori',
    email: 'youssef.mansoori@dubai.ae',
    status: 'Pending Plan',
    paymentMethod: 'Stripe',
    amountPaid: '$250 USD',
    joinedDate: 'July 5, 2026',
    intake: {
      age: 29,
      weight: 94,
      targetWeight: 82,
      medicalConditions: ['Mild Lower Back Pain (L4/L5)', 'Hypertension'],
      allergies: ['Peanuts', 'Shellfish'],
      dietaryPreference: 'Halal / High Protein',
      activityLevel: 'Sedentary (Office Work 10h/day)',
      goals: 'Drop body fat rapidly, fix posture, build upper body mass.'
    }
  };

  // Form bindings for Coach Aymen's plan creation
  customMacros = { calories: 2200, protein: 180, carbs: 200, fats: 65 };
  workoutPlanText: string = '';
  isSaving: boolean = false;

  ngOnInit(): void {
    // Initialization logic / Firestore fetch using route params would go here
    this.workoutPlanText = `• Day 1: Push Focus (Chest/Shoulders/Triceps)\n• Day 2: Pull Focus (Back/Biceps)\n• Day 3: Active Recovery / Mobility\n• Day 4: Lower Body (Legs/Core)`;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Pending Plan': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Active': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Check-in Needed': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  }

  publishPlan(): void {
    this.isSaving = true;

    // Simulating Firebase Firestore Update
    setTimeout(() => {
      this.client.status = 'Active';
      this.isSaving = false;
      alert(`Plan successfully published! Client notified via automatic webhook.`);
    }, 1200);
  }
}
