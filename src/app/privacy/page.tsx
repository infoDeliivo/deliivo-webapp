'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const privacyText = `
1. Introduction
Deliivo Technologies OÜ ("Deliivo", "we", "our", or "us") is committed to protecting your privacy and processing your personal data in accordance with applicable data protection laws, including the General Data Protection Regulation (EU) 2016/679 ("GDPR").
This Privacy Policy explains how we collect, use, disclose, store, and protect your personal data when you access or use the Deliivo website, mobile applications, and related services (collectively, the "Platform").
By using the Platform, you acknowledge that your personal data may be processed as described in this Privacy Policy.

2. Data Controller
The controller responsible for processing your personal data is:
Deliivo Technologies OÜ
Registry Code: 17560200
Email: privacy@deliivo.com
Website: https://www.deliivo.com
If you have questions regarding this Privacy Policy or your personal data, please contact us using the email address above.

3. Personal Data We Collect

3.1 Information You Provide
When creating an account or using the Platform, we may collect:
- Full name
- Email address
- Phone number
- Profile photograph
- Date of birth
- Vehicle information
- Driver licence information
- Payment-related information
- Customer support communications
- Ratings and reviews

3.2 Trip and Route Information
To facilitate ride matching and trip management, we may collect:
- Departure locations
- Destination locations
- Pickup points
- Drop-off points
- Trip schedules
- Route preferences
- Booking history

3.3 Real-Time Location Information
When using the Deliivo mobile application during an active trip, we may collect precise GPS location data.
Location tracking is used for:
- Route monitoring
- Trip coordination
- Rider and Driver matching
- Safety features
- Trip verification
- Customer support
- Fraud prevention
Location tracking is only active when:
- The Deliivo mobile application is installed;
- Required permissions have been granted; and
- A trip is active.
The Deliivo website does not continuously collect GPS location data.
Users may manage location permissions through their device settings.

3.4 Automatically Collected Information
We may automatically collect:
- Device type
- Operating system
- Browser information
- IP address
- Language settings
- Log information
- Usage statistics
- App interaction data

4. How We Use Your Personal Data
We use personal data to:
- Create and manage accounts
- Match Drivers and Riders
- Process bookings
- Process payments
- Facilitate communication between users
- Improve Platform functionality
- Prevent fraud and abuse
- Respond to support requests
- Comply with legal obligations
- Ensure user safety
- Analyze usage trends
- Develop new features

5. Legal Bases for Processing
Under GDPR, we process personal data based on one or more of the following legal grounds:
Contract Performance
Processing necessary to provide Platform services and facilitate bookings.
Legitimate Interests
Processing necessary to:
- Improve Platform performance
- Prevent fraud
- Ensure security
- Resolve disputes
Consent
Where required, including:
- GPS location permissions
- Marketing communications
- Optional features
Legal Obligations
Processing necessary to comply with applicable laws and regulatory requirements.

5.1 Additional Information on Legal Bases
Depending on the type of service used and the nature of personal data involved, Deliivo may rely on different legal bases for processing personal data.
Account registration, booking management, trip coordination and payment processing are generally processed for the performance of a contract.
Where required, Deliivo relies on user consent for certain processing activities, including location permissions, marketing communications and optional platform features.
Deliivo may also process personal data where necessary for its legitimate interests, including improving platform performance, preventing fraud, maintaining security, resolving disputes and ensuring user safety.
In certain circumstances, Deliivo may process personal data to comply with applicable legal and regulatory obligations.
The legal basis applied may vary depending on the specific functionality of the Platform being used.

6. Payments and Stripe
Payments made through the Platform may be processed by Stripe and affiliated payment service providers.
Deliivo does not store full payment card details.
Payment information is processed directly by Stripe in accordance with Stripe's privacy practices and security standards.
Users should review Stripe's privacy documentation for additional information.

7. Sharing Personal Data
We may share personal data with:
Other Users
To facilitate Trips, Drivers and Riders may see limited profile information including:
- First name
- Profile photo
- Ratings
- Trip-related information
Service Providers
We may share data with trusted service providers that assist us with:
- Payment processing
- Cloud hosting
- Analytics
- Customer support
- Identity verification
- Communication services
Authorities
We may disclose information where required by law or where necessary to:
- Protect legal rights
- Prevent fraud
- Respond to lawful requests
- Protect user safety

8. International Data Transfers
Some service providers may process data outside the European Economic Area (EEA).
Where such transfers occur, Deliivo will ensure appropriate safeguards are implemented, including:
- European Commission adequacy decisions;
- Standard Contractual Clauses (SCCs); or
- Other lawful transfer mechanisms.

9. Data Retention
We retain personal data only for as long as necessary to:
- Provide Platform services;
- Comply with legal obligations;
- Resolve disputes;
- Enforce agreements.
Retention periods may vary depending on the type of data and applicable legal requirements.
Where possible, data will be deleted or anonymized after it is no longer required.

9.1 Retention Periods
For transparency and compliance with applicable data protection laws, Deliivo applies retention periods based on the category of personal data and business necessity.
Examples include:
- Account information - retained while the account remains active and for a limited period thereafter where required.
- Trip and booking records - retained for operational, dispute resolution, and legal compliance purposes.
- Payment-related records - retained in accordance with applicable financial and accounting obligations.
- Customer support communications - retained only as necessary to manage support requests and improve service quality.
Where retention is no longer required, data will be deleted, anonymized, or securely archived where legally permitted.

10. Your GDPR Rights
Subject to applicable law, you have the right to:
- Access your personal data
- Correct inaccurate information
- Request deletion of your data
- Restrict processing
- Object to processing
- Withdraw consent
- Request data portability
- Lodge a complaint with a supervisory authority
Requests may be submitted to privacy@deliivo.com

11. Cookies and Analytics
The Deliivo website may use cookies and similar technologies to:
- Maintain functionality
- Analyze usage
- Improve performance
- Remember user preferences
Users may manage cookie settings through their browser preferences.
Where required by law, consent will be obtained before non-essential cookies are used.

12. Security Measures
Deliivo implements technical and organizational measures designed to protect personal data, including:
- Encryption at rest where applicable
- Encryption in transit
- Secure authentication
- Access controls
- Monitoring and security procedures
While we strive to protect personal data, no method of transmission or storage is completely secure.

13. Children's Privacy
The Platform is not intended for individuals under the age of 18.
Deliivo does not knowingly collect personal data from children.
If we become aware that personal data from a child has been collected, we will take reasonable steps to delete such information.

14. Changes to This Privacy Policy
Deliivo may update this Privacy Policy from time to time.
Material changes will be communicated through the Platform or other appropriate channels.
Continued use of the Platform following such updates constitutes acknowledgment of the revised Privacy Policy.

15. Automated Decision Making
Deliivo does not make decisions producing legal or similarly significant effects based solely on automated processing.

16. Third-party Services
The Platform may integrate third-party services necessary for functionality, mapping, analytics, communication, and payment processing. Such providers process personal data in accordance with their own privacy policies and applicable law.

17. Contact Us
For privacy-related questions or requests, contact:
Deliivo Technologies OÜ
Registry Code: 17560200
Email: privacy@deliivo.com
Website: https://www.deliivo.com

18. Supervisory Authority
Users located within the European Union have the right to lodge complaints with their local data protection authority.
Users may also contact the supervisory authority in the EU Member State where they reside, work, or where the alleged infringement occurred.
For Estonia, the competent supervisory authority is:
Andmekaitse Inspektsioon (Estonian Data Protection Inspectorate)
Website: https://aki.ee
`;

function PolicyDocument({ text }: { text: string }) {
  const lines = text.trim().split('\n');

  return (
    <article className="rounded-lg bg-white p-5 shadow-sm sm:p-6">
      <div className="space-y-3 text-sm leading-6 text-deliivo-gray">
        {lines.map((line, index) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={index} className="h-2" />;

          if (/^\d+(\.\d+)?\.\s/.test(trimmed)) {
            return (
              <h2 key={index} className="pt-4 text-lg font-semibold text-deliivo-dark first:pt-0">
                {trimmed}
              </h2>
            );
          }

          if (trimmed.startsWith('- ')) {
            return (
              <p key={index} className="-my-1 pl-5">
                <span className="mr-2 text-deliivo-orange">•</span>
                {trimmed.slice(2)}
              </p>
            );
          }

          return <p key={index}>{trimmed}</p>;
        })}
      </div>
    </article>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-full flex-col bg-deliivo-cream">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase text-deliivo-orange">Privacy Policy</p>
          <h1 className="mt-2 text-3xl font-bold text-deliivo-dark">Deliivo Platform Privacy Policy</h1>
          <p className="mt-3 text-sm text-deliivo-gray">
            Jurisdiction focus: Estonia, Latvia, Lithuania, EU/EEA, GDPR
          </p>
          <p className="mt-1 text-sm text-deliivo-gray">Last updated: 05 August 2026</p>
        </div>

        <PolicyDocument text={privacyText} />
      </main>
      <Footer />
    </div>
  );
}
