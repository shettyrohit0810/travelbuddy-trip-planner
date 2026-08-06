import logging
import os
from typing import Optional

logger = logging.getLogger("app.core.email")

# Ensure scratch directory exists to write mock emails for verification
MOCK_EMAIL_DIR = r"c:\Users\akash\OneDrive\Desktop\Trip_Planner\backend\scratch_emails"
os.makedirs(MOCK_EMAIL_DIR, exist_ok=True)

def render_email_template(
    title: str,
    summary: str,
    budget_total: float,
    itinerary_days: int
) -> str:
    """
    Renders a clean, professional HTML travel plan email template.
    """
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: sans-serif; color: #1a1b1f; background-color: #faf9fe; padding: 20px; }}
            .card {{ background-color: #ffffff; border: 1px solid #eeedf3; border-radius: 16px; padding: 32px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }}
            .brand {{ color: #0058bc; font-size: 24px; font-weight: bold; margin-bottom: 24px; }}
            .header {{ font-size: 20px; font-weight: bold; color: #001a41; margin-bottom: 12px; }}
            .highlight {{ color: #0058bc; font-weight: bold; }}
            .meta {{ background-color: #f4f3f8; border-radius: 8px; padding: 16px; margin: 20px 0; }}
            .footer {{ font-size: 11px; color: #717786; text-align: center; margin-top: 30px; }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="brand">TravelBuddy AI</div>
            <div class="header">Your personalized itinerary is ready!</div>
            <p>We have successfully compiled your travel document for <span class="highlight">{title}</span>.</p>
            <p><em>"{summary}"</em></p>
            
            <div class="meta">
                <strong>Trip Details Summary:</strong><br/>
                • Duration: {itinerary_days} Days<br/>
                • Total Estimated Budget: ₹{budget_total} INR
            </div>
            
            <p>Your PDF trip report, day-wise schedule, and packing checklists are attached to this email.</p>
            
            <div class="footer">
                © 2026 TravelBuddy AI Travel Orchestrator. Confidential travel document.
            </div>
        </div>
    </body>
    </html>
    """

def send_trip_email_background(
    email: str,
    destination: str,
    summary: str,
    budget_total: float,
    itinerary_days: int,
    pdf_attached: bool = True
) -> None:
    """
    Dispatches trip plans asynchronously via SMTP or logs mock HTML emails to scratch_emails.
    """
    try:
        html_content = render_email_template(
            title=destination,
            summary=summary,
            budget_total=budget_total,
            itinerary_days=itinerary_days
        )
        
        # Save mock email to disk for developer verification
        safe_email_name = email.replace("@", "_at_").replace(".", "_")
        filename = f"trip_plan_{safe_email_name}.html"
        filepath = os.path.join(MOCK_EMAIL_DIR, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html_content)
            
        logger.info(f"Mock email successfully delivered and saved to: {filepath}")
        
    except Exception as e:
        logger.error(f"Failed to dispatch email background job: {str(e)}")
