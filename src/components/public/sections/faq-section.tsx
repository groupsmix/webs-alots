import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const faqs = [
  {
    q: "How do I book an appointment?",
    a: "You can book online through our website by clicking the 'Book an Appointment' button, or call us directly during working hours.",
  },
  {
    q: "What insurance do you accept?",
    a: "We accept most major insurance providers including CNSS, CNOPS, RMA, SAHAM, and AXA. Please contact us for specific coverage details.",
  },
  {
    q: "What are your working hours?",
    a: "We are open Monday to Friday from 9:00 AM to 5:00 PM, and Saturday from 9:00 AM to 1:00 PM. We are closed on Sundays.",
  },
  {
    q: "Do I need a referral?",
    a: "No referral is needed for a general consultation. Some specialized services may require a referral from your primary care physician.",
  },
  {
    q: "Can I cancel or reschedule?",
    a: "Yes, you can cancel or reschedule your appointment up to 24 hours in advance through our website or by calling us.",
  },
];

export function FaqSection() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-center text-3xl font-bold mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-center text-muted-foreground mb-8">
          Find answers to common questions about our services.
        </p>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.q}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{faq.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
