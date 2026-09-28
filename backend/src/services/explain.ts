export async function generateCopilotExplanation(scanData: any, lang: string = 'en') {
  const isHindi = lang.toLowerCase() === 'hi';
  if (isHindi) {
    return {
      language: 'hi',
      summary: `यह पता (${scanData.address}) ${scanData.verdict} के रूप में classified किया गया है जिसका risk score ${scanData.score}/100 है।`,
      reasons: scanData.reasons,
      nextSteps: [
        "तुरंत राष्ट्रीय साइबर अपराध रिपोर्टिंग पोर्टल (cybercrime.gov.in) पर रिपोर्ट करें।",
        "सहायता के लिए आधिकारिक साइबर अपराध हेल्पलाइन नंबर 1930 पर कॉल करें।"
      ]
    };
  }
  return {
    language: 'en',
    summary: `The address (${scanData.address}) evaluated to a verdict of ${scanData.verdict} with a risk score of ${scanData.score}/100.`,
    reasons: scanData.reasons,
    nextSteps: [
      "Report the activity immediately to the National Cybercrime Portal at cybercrime.gov.in.",
      "Call the official cybercrime helpline at 1930 for urgent support and guidance."
    ]
  };
}
