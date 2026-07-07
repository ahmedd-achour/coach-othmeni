import { Component, OnInit } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Functions, httpsCallable } from '@angular/fire/functions';

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

interface FormData {
  name: string;
  email: string;
  phone: string;
  height: number | null;
  weight: number | null;
  targetWeight: number | null;
  country: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  metrics: Metric[] = [
    { value: '22+', label: 'Years Experience' },
    { value: '1000+', label: 'Transformations' },
    { value: '99.7%', label: 'Custom Blueprint' },
    { value: '54,000+', label: 'Instagram Community' },
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
      price: 149,
      features: [
        'custom training program built around your goals',
        'weekly check-ins to track your progress',
        'progress photo review by your coach',
        'full plan review every month',
        'email support whenever you need it'
      ],
      isPopular: false,
      ctaText: 'Apply For Standard Pack',
      stripePriceId: 'price_1TqZkvQBeLJr5RNok0Uescs2', // 👈 Remplace par ton ID Stripe mensuel
      stripePdfPriceId: 'price_1TqZnSQBeLJr5RNosJjONDSr'    },
    {
      name: 'Premium Coaching',
      price: 199,
      features: [
        'custom training program built around your goals',
        'personalized nutrition plan for how you actually eat',
        'your plan adjusted every two weeks',
        'swappable meals and a ready-to-use grocery list',
        'weekly check-ins to track your progress',
        'progress photo review by your coach',
        'direct whatsapp access to your coach'
      ],
      isPopular: true,
      ctaText: 'Apply For Premium Pack',
      stripePriceId: 'price_1TqZl8QBeLJr5RNoFNqZvDGX', // 👈 Remplace par ton ID Stripe mensuel
      stripePdfPriceId: 'price_1TqZnSQBeLJr5RNosJjONDSr'    },
    {
      name: 'VIP Elite Coaching',
      price: 249,
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
stripePriceId: 'price_1TqZlNQBeLJr5RNoYdujVKb8', // 👈 Remplace par ton ID Stripe mensuel
      stripePdfPriceId: 'price_1TqZnSQBeLJr5RNosJjONDSr'    }
  ];

  isPopupVisible = false;
  currentStep = 1;
  selectedPlan: PricingTier | null = null;
  stripeErrorMessage = '';
  isProcessingPayment = false;
  checkoutOpened = false;

  formData: FormData = {
    name: '',
    email: '',
    phone: '',
    height: null,
    weight: null,
    targetWeight: null,
    country: ''
  };

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

  /**
   * Pipeline de paiement avec système de traçabilité par alertes graphiques.
   */
  async handlePaymentSubmit(): Promise<void> {
    if (this.isProcessingPayment || !this.selectedPlan) return;

    if (!this.formData.country?.trim()) {
      this.stripeErrorMessage = 'Please select your country of residence.';
      return;
    }

    this.isProcessingPayment = true;
    this.stripeErrorMessage = '';

    // 📢 ALERT DEBUG 1 : Formulaire validé localement, envoi au serveur
    alert(`🔍 [DEBUG 1/3] Data validated! Contacting 'createCheckoutSession' Cloud Function for ${this.formData.email}...`);

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
        subscription: {
          plan_name: this.selectedPlan.name,
          amount: Number(this.selectedPlan.price),
          stripePriceId: this.selectedPlan.stripePriceId, // ⚠️ Vérifie que ce n'est pas undefined
          stripePdfPriceId: this.selectedPlan.stripePdfPriceId // ⚠️ Vérifie que ce n'est pas undefined
        }
      };

      console.log('🔄 Payload sent to Firebase:', payload);
      const result = await createCheckoutSessionFn(payload);
      console.log('✅ Response received from Firebase:', result);

      if (result?.data?.checkoutUrl) {
        // 📢 ALERT DEBUG 2 : Succès de la fonction, redirection imminente
        alert(`✅ [DEBUG 2/3] Success! Application ID created: ${result.data.applicationId}. Redirecting to Stripe URL...`);
        window.location.href = result.data.checkoutUrl;
      } else {
        throw new Error('The Cloud Function executed but returned an empty checkout URL.');
      }

    } catch (err: any) {
      console.error('❌ Cloud Function Crash Log:', err);

      // Extraction du message d'erreur interne renvoyé par Node.js
      const backendErrorDetails = err.details ? JSON.stringify(err.details) : '';
      const exactErrorMessage = err.message || 'Unknown network error';

      // 📢 ALERT DEBUG 3 : Erreur Interne interceptée avec détails réels
      alert(`❌ [DEBUG 3/3] INTERNAL ERROR DETECTED!\n\nMessage: ${exactErrorMessage}\n\nDetails: ${backendErrorDetails}\n\nPlease check firebase functions:log.`);

      this.stripeErrorMessage = `Backend Error: ${exactErrorMessage}. Check console logs.`;
    } finally {
      this.isProcessingPayment = false;
    }
  }

  isStep1Valid(): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;

    const { name, email, phone, height, weight, targetWeight } = this.formData;

    if (!name || name.trim().length < 2) return false;
    if (!email || !emailRegex.test(email)) return false;
    if (!phone || !phoneRegex.test(phone)) return false;
    if (height === null || height < 50 || height > 300) return false;
    if (weight === null || weight < 20 || weight > 500) return false;
    if (targetWeight === null || targetWeight < 20 || targetWeight > 500) return false;

    return true;
  }

  openPopup(plan?: PricingTier): void {
    this.selectedPlan = plan || this.pricingTiers[1];
    this.currentStep = 1;
    this.isPopupVisible = true;
    this.stripeErrorMessage = '';
    this.checkoutOpened = false;
    this.formData = { name: '', email: '', phone: '', height: null, weight: null, targetWeight: null, country: '' };
    document.body.style.overflow = 'hidden';
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
    if (step === 2) {
      if (!this.isStep1Valid()) {
        this.stripeErrorMessage = 'Please fill out all metric validation fields accurately first.';
        return;
      }
      this.stripeErrorMessage = '';
    }
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
