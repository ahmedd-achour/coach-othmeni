import { Component, OnInit, AfterViewInit } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Functions, httpsCallable } from '@angular/fire/functions';
import Swal from 'sweetalert2'

interface Metric {
  value: string;
  label: string;
}

interface MethodStep {
  number: string;
  title: string;
  description: string;
}

interface PricingTier {
  name: string;
  price: number;
  features: string[];
  isPopular?: boolean;
  ctaText: string;
  stripePriceId: string;    // 👈 Ajouté pour l'abonnement récurrent mensuel
  stripePdfPriceId: string; // 👈 Ajouté pour le frais unique du PDF à 1$
}

interface NutritionLeaf {
  name: string;
}

export interface FormData {

  // Existing
  name: string;
  email: string;
  phone: string;

  height: number | null;
  weight: number | null;
  targetWeight: number | null;

  country: string;

  // ------------------------
  // PERSONAL
  // ------------------------

  age: number | null;
  gender: string;

  // ------------------------
  // GOALS
  // ------------------------

  weightGoal: string;
  targetDate: string;

  previousAttempts: string;
  workedBefore: string;
  didntWorkBefore: string;
  yoyoDieting: string;

  // ------------------------
  // TRAINING
  // ------------------------

  experience: string;
  equipment: string;
  trainingDays: string;
  preferredTrainingTime: string;

  injuries: string;
  activityLevel: string;

  // ------------------------
  // NUTRITION
  // ------------------------

  dietPreference: string;

  allergies: string;

  dislikedFoods: string;

  cookingHabits: string;

  foodBudget: string;

  eatingPattern: string;

  alcoholConsumption: string;

  // ------------------------
  // LIFESTYLE
  // ------------------------

  occupation: string;

  sleepHours: string;

  stressLevel: string;

  waterIntake: string;

  // ------------------------
  // MINDSET
  // ------------------------

  biggestObstacle: string;

  cravingsManagement: string;

  checkInFrequency: string;

  // ------------------------
  // MEDICAL
  // ------------------------

  medicalConditions: string;

  medications: string;

}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, AfterViewInit {

  metrics: Metric[] = [
    { value: '15+', label: 'Years Experience' },
    { value: '1000+', label: 'Transformations' },
    { value: '99.7%', label: 'Custom Blueprint' },
    { value: '57,000+', label: 'Instagram Community' },
  ];

  methodSteps: MethodStep[] = [
    {
      number: '01',
      title: 'Deep Intake Audit',
      description: 'We analyze your starting point: your metabolic baseline, body stats, and current lifestyle roadblocks.'
    },
    {
      number: '02',
      title: 'Tailored Blueprint',
      description: 'We construct a fully personalized training and nutrition plan aligned with your specific food preferences and restrictions.'
    },
    {
      number: '03',
      title: 'Weekly Tuning Checkins',
      description: 'Direct review and weekly feedback loops to adapt details dynamically as your body changes.'
    },
    {
      number: '04',
      title: 'Monthly Video Calls',
      description: 'Regular one-on-one video calls with your coach to discuss progress and adjust your plan as needed.'
    }
  ];

  nutritionLeaves: NutritionLeaf[] = [
    { name: 'Keto / Low Carb Option' },
    { name: 'Halal Compliance' },
    { name: 'Diabetic / PCOS Support' },
    { name: 'Allergy-Safe Filters' },
    { name: 'Premium Macro Audits' }
  ];

  pricingTiers: PricingTier[] = [
    {
      name: 'Standard Coaching',
      price: 150,
      features: [
        'custom training program built around your goals',
        'weekly check-ins to track your progress',
        'progress photo review by your coach',
        'full plan review every month',
        'email support whenever you need it',

      ],
      isPopular: false,
      ctaText: 'Apply For Standard Pack',
      stripePriceId: '1903957', // 👈 Remplace par ton ID Stripe mensuel
      stripePdfPriceId: 'price_1TqZnSQBeLJr5RNosJjONDSr'    },
    {
      name: 'Premium Coaching',
      price: 200,
      features: [
        'custom training program built around your goals',
        'personalized nutrition plan for how you actually eat',
        'your plan adjusted every two weeks',
        'swappable meals and a ready-to-use grocery list',
        'weekly check-ins to track your progress',
        'progress photo review by your coach',
        'direct whatsapp access to your coach',
      ],
      isPopular: true,
      ctaText: 'Apply For Premium Pack',
      stripePriceId: '1903965', // 👈 Remplace par ton ID Stripe mensuel
      stripePdfPriceId: 'price_1TqZnSQBeLJr5RNosJjONDSr'    },
    {
      name: 'VIP Elite Coaching',
      price: 250,
      features: [
        'custom training program built around your goals',
        'personalized nutrition plan for how you actually eat',
        'your plan adjusted every two weeks',
        'swappable meals and a ready-to-use grocery list',
        'weekly check-ins to track your progress',
        'progress photo review by your coach',
        'priority whatsapp access to your coach',
        'a monthly video call with your coach'
      ],
      isPopular: false,
      ctaText: 'Apply For VIP Elite Pack',
      stripePriceId: '1903973', // 👈 Remplace par ton ID Stripe mensuel
      stripePdfPriceId: 'price_1TqZnSQBeLJr5RNosJjONDSr'    }
  ];

  isPopupVisible = false;
  currentStep = 1;
  selectedPlan: PricingTier | null = null;
  stripeErrorMessage = '';
  isProcessingPayment = false;
  checkoutOpened = false;

formData: FormData = {

  // Existing
  name: '',
  email: '',
  phone: '',

  height: null,
  weight: null,
  targetWeight: null,

  country: '',

  // PERSONAL

  age: null,
  gender: '',

  // GOALS

  weightGoal: '',
  targetDate: '',

  previousAttempts: '',
  workedBefore: '',
  didntWorkBefore: '',
  yoyoDieting: '',

  // TRAINING

  experience: '',
  equipment: '',
  trainingDays: '',
  preferredTrainingTime: '',

  injuries: '',
  activityLevel: '',

  // NUTRITION

  dietPreference: '',
  allergies: '',
  dislikedFoods: '',
  cookingHabits: '',
  foodBudget: '',
  eatingPattern: '',
  alcoholConsumption: '',

  // LIFESTYLE

  occupation: '',
  sleepHours: '',
  stressLevel: '',
  waterIntake: '',

  // MINDSET

  biggestObstacle: '',
  cravingsManagement: '',
  checkInFrequency: '',

  // MEDICAL

  medicalConditions: '',
  medications: ''

};
  async handlePaymentSubmit(): Promise<void> {
    if (this.isProcessingPayment || !this.selectedPlan) return;

    if (!this.formData.country?.trim()) {
      this.stripeErrorMessage = 'Please select your country of residence.';
      return;
    }

    this.isProcessingPayment = true;
    this.stripeErrorMessage = '';


    try {
      const createCheckoutSessionFn = httpsCallable<any, { checkoutUrl: string; applicationId: string }>(
        this.functions,
        'createCheckoutSession'
      );

    const payload = {

  client_profile: {

    name: this.formData.name.trim(),

    email: this.formData.email.trim().toLowerCase(),

    phone: this.formData.phone.trim(),

    country: this.formData.country.trim()

  },

  physical_metrics: {

    height_cm: Number(this.formData.height),

    current_weight_kg: Number(this.formData.weight),

    target_weight_kg: Number(this.formData.targetWeight)

  },

  coaching_questionnaire: {

    personal: {

      age: this.formData.age,

      gender: this.formData.gender,


    },

    goals: {

      desired_weight_loss: this.formData.weightGoal,

      target_date: this.formData.targetDate,

      previous_attempts: this.formData.previousAttempts,

      worked_before: this.formData.workedBefore,

      didnt_work: this.formData.didntWorkBefore,

      yoyo_dieting: this.formData.yoyoDieting

    },

    training: {

      experience: this.formData.experience,

      equipment: this.formData.equipment,

      training_days: this.formData.trainingDays,

      preferred_time: this.formData.preferredTrainingTime,

      injuries: this.formData.injuries,

      activity_level: this.formData.activityLevel

    },

    nutrition: {

      diet: this.formData.dietPreference,

      allergies: this.formData.allergies,

      disliked_foods: this.formData.dislikedFoods,

      cooking: this.formData.cookingHabits,

      food_budget: this.formData.foodBudget,

      eating_pattern: this.formData.eatingPattern,

      alcohol: this.formData.alcoholConsumption

    },

    lifestyle: {

      occupation: this.formData.occupation,

      sleep_hours: this.formData.sleepHours,

      stress_level: this.formData.stressLevel,

      water_intake: this.formData.waterIntake

    },

    mindset: {

      biggest_obstacle: this.formData.biggestObstacle,

      cravings_management: this.formData.cravingsManagement,

      checkin_frequency: this.formData.checkInFrequency

    },

    medical: {

      medical_conditions: this.formData.medicalConditions,

      medications: this.formData.medications

    }

  },

  subscription: {

    plan_name: this.selectedPlan.name,

    amount: Number(this.selectedPlan.price),

    stripePriceId: this.selectedPlan.stripePriceId,

    stripePdfPriceId: this.selectedPlan.stripePdfPriceId

  }

};

      console.log('🔄 Payload sent to Firebase:', payload);
      const result = await createCheckoutSessionFn(payload);
      console.log('✅ Response received from Firebase:', result);

      if (result?.data?.checkoutUrl) {
        // 📢 ALERT DEBUG 2 : Succès de la fonction, redirection imminente
       // alert(`✅ [DEBUG 2/3] Success! Application ID created: ${result.data.applicationId}. Redirecting to Stripe URL...`);


       //kif traja3 hethi chekout temchiiiiii
       // window.location.href = result.data.checkoutUrl;
       this.closePopup();
       Swal.fire({
  title: "Application sent!",
  text: "Coach Aymen Othmeni would contact you soon!",
  icon: "success"
});


window.location.href = "https://wa.me/971526164854?text=can%20i%20purshase%20this%20pdf%20item%20found%20in%20your%20website%20%3F"


      } else {
      //  throw new Error('The Cloud Function executed but returned an empty checkout URL.');
      }

    } catch (err: any) {
      console.error('❌ Cloud Function Crash Log:', err);

      // Extraction du message d'erreur interne renvoyé par Node.js
      const backendErrorDetails = err.details ? JSON.stringify(err.details) : '';
      const exactErrorMessage = err.message || 'Unknown network error';

      // 📢 ALERT DEBUG 3 : Erreur Interne interceptée avec détails réels
     // alert(`❌ [DEBUG 3/3] INTERNAL ERROR DETECTED!\n\nMessage: ${exactErrorMessage}\n\nDetails: ${backendErrorDetails}\n\nPlease check firebase functions:log.`);

      this.stripeErrorMessage = `Backend Error: ${exactErrorMessage}. Check console logs.`;
    } finally {
      this.isProcessingPayment = false;
    }
  }
  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private functions: Functions
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const sessionId = params['session_id'] || params['sessionId'];
      if (sessionId) {
        alert('🎉 Payment Succeeded & Application Finalized! Coach Aymen will contact you shortly.');
        this.closePopup();
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });
  }

  ngAfterViewInit(): void {
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      const els = document.querySelectorAll('.reveal');
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12 });
      els.forEach(el => io.observe(el));
    }
  }

  /**
   * Pipeline de paiement avec système de traçabilité par alertes graphiques.
   */


isStep1Valid(): boolean {

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;

  const {
    name,
    email,
    phone,
    age,
    gender,
    height,
    weight,
    targetWeight,
    country,

  } = this.formData;


  if (!name || name.trim().length < 2) return false;

  if (!email || !emailRegex.test(email)) return false;

  if (!phone || !phoneRegex.test(phone)) return false;


  if (
    age === null ||
    age < 10 ||
    age > 100
  ) return false;


  if (!gender) return false;


  if (
    height === null ||
    height < 50 ||
    height > 300
  ) return false;


  if (
    weight === null ||
    weight < 20 ||
    weight > 500
  ) return false;


  if (
    targetWeight === null ||
    targetWeight < 20 ||
    targetWeight > 500
  ) return false;


  if (!country) return false;



  return true;

}

isStep2Valid(): boolean {

  const {
    weightGoal,
    targetDate,
    previousAttempts

  } = this.formData;


  if (!weightGoal || weightGoal.trim().length < 2)
    return false;


  if (!targetDate)
    return false;


  if (!previousAttempts || previousAttempts.trim().length < 5)
    return false;


  return true;

}


isStep3Valid(): boolean {

  const {
    experience,
    equipment,
    trainingDays,
    preferredTrainingTime

  } = this.formData;


  if (!experience) return false;

  if (!equipment) return false;

  if (!trainingDays) return false;

  if (!preferredTrainingTime) return false;


  return true;

}

isStep4Valid(): boolean {
  return true;
}

isStep5Valid(): boolean {
  return true;
}

isStep6Valid(): boolean {
  return true;
}

isStep7Valid(): boolean {
  return true;
}

  openPopup(plan?: PricingTier): void {
    this.selectedPlan = plan || this.pricingTiers[1];
    this.currentStep = 1;
    this.isPopupVisible = true;
    this.stripeErrorMessage = '';
    this.checkoutOpened = false;
this.formData = {

  // Existing
  name: '',
  email: '',
  phone: '',

  height: null,
  weight: null,
  targetWeight: null,

  country: '',

  // PERSONAL

  age: null,
  gender: '',

  // GOALS

  weightGoal: '',
  targetDate: '',

  previousAttempts: '',
  workedBefore: '',
  didntWorkBefore: '',
  yoyoDieting: '',

  // TRAINING

  experience: '',
  equipment: '',
  trainingDays: '',
  preferredTrainingTime: '',

  injuries: '',
  activityLevel: '',

  // NUTRITION

  dietPreference: '',
  allergies: '',
  dislikedFoods: '',
  cookingHabits: '',
  foodBudget: '',
  eatingPattern: '',
  alcoholConsumption: '',

  // LIFESTYLE

  occupation: '',
  sleepHours: '',
  stressLevel: '',
  waterIntake: '',

  // MINDSET

  biggestObstacle: '',
  cravingsManagement: '',
  checkInFrequency: '',

  // MEDICAL

  medicalConditions: '',
  medications: ''

};    document.body.style.overflow = 'hidden';
  }

  closePopup(): void {
    this.isPopupVisible = false;
    this.currentStep = 1;
    this.checkoutOpened = false;
    document.body.style.overflow = '';
  }

  closeOnBackdrop(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('popup-overlay')) {
      this.closePopup();
    }
  }

goToStep(step: number): void {
  if (step === 2 && !this.isStep1Valid()) return;
  if (step === 3 && !this.isStep2Valid()) return;
  if (step === 4 && !this.isStep3Valid()) return;
  if (step === 5 && !this.isStep4Valid()) return;
  if (step === 6 && !this.isStep5Valid()) return;
  if (step === 7 && !this.isStep6Valid()) return;

  this.currentStep = step;
}

  onSubmit(): void {
    if (this.currentStep === 1) {
      this.goToStep(2);
    }
  }

  selectPlan(plan: PricingTier): void {
    this.openPopup(plan);
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
